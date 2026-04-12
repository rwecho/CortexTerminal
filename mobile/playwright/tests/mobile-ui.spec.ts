import { expect, test, type Page } from "@playwright/test";

const fakeAccessToken = "playwright-access-token";

const principal = {
  subject: "user-playwright",
  username: "playwright-user",
  displayName: "Playwright User",
  email: "playwright@example.com",
  scopes: ["gateway.api", "relay.connect"],
};

const workers = [
  {
    workerId: "worker-ui-test",
    displayName: "Worker UI Test",
    modelName: "Claude CLI",
    availablePaths: ["/workspace/CortexTerminal"],
    lastKnownState: "Online",
    currentConnectionId: "conn-1",
    createdAtUtc: "2026-04-07T10:00:00Z",
    updatedAtUtc: "2026-04-07T10:00:00Z",
    lastHeartbeatAtUtc: "2026-04-07T10:05:00Z",
    isOnline: true,
  },
];

const sessions = [
  {
    sessionId: "session-playwright-1",
    userId: "user-playwright",
    workerId: "worker-ui-test",
    displayName: "Repo Session",
    workingDirectory: "/workspace/CortexTerminal",
    state: "Active",
    mobileConnectionId: null,
    traceId: "trace-playwright",
    createdAtUtc: "2026-04-07T10:00:00Z",
    updatedAtUtc: "2026-04-07T10:00:00Z",
    lastActivityAtUtc: "2026-04-07T10:05:00Z",
    isActive: true,
  },
];

const auditEntries = [
  {
    id: "audit-1",
    category: "worker",
    kind: "worker/deleted",
    summary: "Worker cleaned up",
    actorType: "user",
    actorId: "user-playwright",
    workerId: "worker-ui-test",
    payloadJson: JSON.stringify({ workerId: "worker-ui-test" }),
    createdAtUtc: "2026-04-07T10:06:00Z",
  },
  {
    id: "audit-2",
    category: "session",
    kind: "session/created",
    summary: "Session created",
    actorType: "user",
    actorId: "user-playwright",
    sessionId: "session-playwright-1",
    payloadJson: JSON.stringify({ sessionId: "session-playwright-1" }),
    createdAtUtc: "2026-04-07T10:07:00Z",
  },
];

type MockShellOverrides = {
  workers?: typeof workers;
  sessions?: typeof sessions;
  auditEntries?: typeof auditEntries;
};

type RelayStateSnapshot = {
  connected: boolean;
  connectCalls: Array<{
    sessionId: string;
    workerId: string;
  }>;
  sentFrames: Array<{
    sessionId: string;
    text: string;
    requestId: string | null;
    traceId: string | null;
  }>;
  disconnectCount: number;
};

async function installMockRelay(page: Page) {
  await page.addInitScript(() => {
    const decoder = new TextDecoder();

    const state = {
      connected: false,
      connectCalls: [] as Array<{ sessionId: string; workerId: string }>,
      sentFrames: [] as Array<{
        sessionId: string;
        text: string;
        requestId: string | null;
        traceId: string | null;
      }>,
      disconnectCount: 0,
      onWorkerFrame: null as ((
        sessionId: string,
        payload: Uint8Array,
        metadata: { requestId?: string; traceId?: string },
      ) => void) | null,
      lifecycleHandlers: null as {
        onReconnecting?: (error?: Error) => void;
        onReconnected?: (connectionId?: string) => void | Promise<void>;
        onClose?: (error?: Error) => void;
      } | null,
    };

    (window as typeof window & Record<string, unknown>)
      .__cortexPlaywrightRelay = {
      state,
      emitWorkerText(
        sessionId: string,
        text: string,
        metadata?: { requestId?: string; traceId?: string },
      ) {
        state.onWorkerFrame?.(
          sessionId,
          new TextEncoder().encode(text),
          metadata ?? {},
        );
      },
      triggerReconnecting(message?: string) {
        state.lifecycleHandlers?.onReconnecting?.(
          message ? new Error(message) : undefined,
        );
      },
      async triggerReconnected(connectionId = "playwright-reconnected") {
        state.connected = true;
        await state.lifecycleHandlers?.onReconnected?.(connectionId);
      },
      triggerClose(message?: string) {
        state.connected = false;
        state.lifecycleHandlers?.onClose?.(
          message ? new Error(message) : undefined,
        );
      },
    };

    window.__cortexRelayClientFactoryOverride = ({
      onWorkerFrame,
      lifecycleHandlers,
    }) => {
      state.onWorkerFrame = onWorkerFrame;
      state.lifecycleHandlers = lifecycleHandlers ?? null;

      return {
        async connect(sessionId: string, workerId: string) {
          state.connected = true;
          state.connectCalls.push({ sessionId, workerId });
        },
        async sendMobileFrame(
          sessionId: string,
          payload: Uint8Array,
          metadata?: { requestId?: string; traceId?: string },
        ) {
          state.sentFrames.push({
            sessionId,
            text: decoder.decode(payload),
            requestId: metadata?.requestId ?? null,
            traceId: metadata?.traceId ?? null,
          });
        },
        async disconnect() {
          state.connected = false;
          state.disconnectCount += 1;
        },
        isConnected() {
          return state.connected;
        },
      };
    };
  });
}

async function waitForRelayConnects(page: Page, count: number) {
  await page.waitForFunction(
    (expectedCount) =>
      ((globalThis as Record<string, unknown>).__cortexPlaywrightRelay as {
        state?: { connectCalls?: unknown[] };
      } | undefined)?.state?.connectCalls?.length >= expectedCount,
    count,
  );
}

async function waitForRelayFrames(page: Page, count: number) {
  await page.waitForFunction(
    (expectedCount) =>
      ((globalThis as Record<string, unknown>).__cortexPlaywrightRelay as {
        state?: { sentFrames?: unknown[] };
      } | undefined)?.state?.sentFrames?.length >= expectedCount,
    count,
  );
}

async function readRelayState(page: Page): Promise<RelayStateSnapshot> {
  return page.evaluate(() => {
    const relay = (globalThis as Record<string, unknown>)
      .__cortexPlaywrightRelay as {
      state: RelayStateSnapshot;
    };

    return {
      connected: relay.state.connected,
      connectCalls: [...relay.state.connectCalls],
      sentFrames: [...relay.state.sentFrames],
      disconnectCount: relay.state.disconnectCount,
    };
  });
}

async function emitWorkerText(page: Page, sessionId: string, text: string) {
  await page.evaluate(
    ([targetSessionId, workerText]) => {
      (
        (globalThis as Record<string, unknown>).__cortexPlaywrightRelay as {
          emitWorkerText: (
            sessionId: string,
            text: string,
            metadata?: { requestId?: string; traceId?: string },
          ) => void;
        }
      ).emitWorkerText(targetSessionId, workerText);
    },
    [sessionId, text] as const,
  );
}

async function triggerRelayReconnecting(page: Page, message: string) {
  await page.evaluate((errorMessage) => {
    (
      (globalThis as Record<string, unknown>).__cortexPlaywrightRelay as {
        triggerReconnecting: (message?: string) => void;
      }
    ).triggerReconnecting(errorMessage);
  }, message);
}

async function triggerRelayReconnected(page: Page) {
  await page.evaluate(async () => {
    await (
      (globalThis as Record<string, unknown>).__cortexPlaywrightRelay as {
        triggerReconnected: (connectionId?: string) => Promise<void>;
      }
    ).triggerReconnected("relay-reconnected-from-playwright");
  });
}

async function mockAuthenticatedShell(
  page: import("@playwright/test").Page,
  overrides: MockShellOverrides = {},
) {
  const state = {
    workers: [...(overrides.workers ?? workers)],
    sessions: [...(overrides.sessions ?? sessions)],
    auditEntries: [...(overrides.auditEntries ?? auditEntries)],
  };

  await page.addInitScript((token) => {
    window.localStorage.setItem("cortex-terminal.gateway.accessToken", token);
  }, fakeAccessToken);

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(principal),
    });
  });

  await page.route("**/api/workers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.workers),
    });
  });

  await page.route("**/api/workers/*/directories**", async (route) => {
    const workerId = route.request().url().match(/\/api\/workers\/([^/]+)\/directories/)?.[1];
    const worker = state.workers.find(
      (candidate) => candidate.workerId === decodeURIComponent(workerId ?? ""),
    );
    const requestedPath = new URL(route.request().url()).searchParams.get("path");

    const entries = requestedPath
      ? []
      : (worker?.availablePaths ?? []).map((path) => ({
          path,
          name: path.split("/").filter(Boolean).at(-1) ?? path,
          hasChildren: true,
          isRoot: true,
        }));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workerId: worker?.workerId ?? "worker-ui-test",
        requestedPath,
        entries,
      }),
    });
  });

  await page.route("**/api/sessions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.sessions),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as {
        workerId: string;
        workingDirectory: string;
        displayName?: string;
        traceId?: string;
      };

      const createdSession = {
        sessionId: "session-created-from-playwright",
        userId: principal.subject,
        workerId: payload.workerId,
        displayName: payload.displayName ?? "Playwright Created Session",
        workingDirectory: payload.workingDirectory,
        state: "Active",
        mobileConnectionId: null,
        traceId: payload.traceId ?? "trace-created-from-playwright",
        createdAtUtc: "2026-04-07T10:08:00Z",
        updatedAtUtc: "2026-04-07T10:08:00Z",
        lastActivityAtUtc: "2026-04-07T10:08:00Z",
        isActive: true,
      };

      state.sessions = [...state.sessions, createdSession];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createdSession),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.sessions[0]),
    });
  });

  await page.route("**/api/audit**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.auditEntries),
    });
  });

  await page.route("**/api/auth/worker/install-token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "iwk_PLAYWR1",
        issuedAtUtc: "2026-04-07T10:09:00Z",
        expiresAtUtc: "2026-04-07T10:19:00Z",
        installUrl:
          "https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_PLAYWR1",
        installCommand:
          "curl -fsSL 'https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_PLAYWR1' | bash",
        installCommands: {
          unixUrl:
            "https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_PLAYWR1",
          unixCommand:
            "curl -fsSL 'https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_PLAYWR1' | bash",
          windowsUrl:
            "https://gateway.ct.rwecho.top/install-worker.ps1?token=iwk_PLAYWR1",
          windowsCommand:
            "powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"& ([ScriptBlock]::Create((Invoke-WebRequest -UseBasicParsing 'https://gateway.ct.rwecho.top/install-worker.ps1?token=iwk_PLAYWR1').Content))\"",
        },
      }),
    });
  });

  await page.route("**/hubs/**", async (route) => {
    await route.abort();
  });
}

test("shows auth screen when not signed in", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "CORTEX TERMINAL" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "登录并进入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "注册" })).toBeVisible();
});

test("authenticated user can navigate app shell routes", async ({ page }) => {
  await mockAuthenticatedShell(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Repo Session Worker UI Test/i }),
  ).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ hasText: "节点" })
      .getByText("Worker UI Test"),
  ).toBeVisible();

  await page.getByRole("button", { name: "新建会话" }).click();
  await expect(page).toHaveURL(/\/sessions\/new$/);
  await expect(page.getByRole("heading", { name: "创建会话" })).toBeVisible();

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();

  await page.getByRole("button", { name: "查看审计" }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByRole("heading", { name: "审计" })).toBeVisible();
});

test("audit page can filter worker records", async ({ page }) => {
  await mockAuthenticatedShell(page);
  await page.goto("/audit");

  await expect(page.getByText("Worker cleaned up")).toBeVisible();
  await expect(page.getByText("Session created")).toBeVisible();

  await page.getByRole("button", { name: "worker" }).click();
  await expect(page.getByText("Worker cleaned up")).toBeVisible();
  await expect(page.getByText("Session created")).toHaveCount(0);

  await page
    .getByPlaceholder("搜索 session / worker / trace / summary")
    .fill("session-playwright-1");
  await expect(
    page.getByText("没有符合当前筛选条件的审计记录。"),
  ).toBeVisible();
});

test("new session flow creates a session and enters terminal shell", async ({
  page,
}) => {
  await installMockRelay(page);
  await mockAuthenticatedShell(page);
  await page.goto("/");
  await page.getByRole("button", { name: "新建会话" }).click();
  await expect(page).toHaveURL(/\/sessions\/new$/);

  await expect(page.getByRole("heading", { name: "创建会话" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "执行节点" })).toContainText(
    "Worker UI Test",
  );
  await expect(page.getByRole("button", { name: /真实目录/ })).toBeVisible();
  await page.getByRole("button", { name: /真实目录/ }).click();
  await expect(
    page.getByRole("dialog", { name: "选择工作目录" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /选择目录 \/workspace\/CortexTerminal/ })
    .click();
  await expect(
    page.locator("div.mt-2.break-all.font-mono.text-\\[12px\\].text-cyan-300"),
  ).toContainText("/workspace/CortexTerminal");
  const createSessionButton = page.getByRole("button", {
    name: "创建并进入终端",
  });
  const createSessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/sessions") &&
      response.request().method() === "POST",
  );

  await expect(createSessionButton).toBeEnabled();
  await createSessionButton.click();
  const createdSessionResponse = await createSessionResponse;

  expect(createdSessionResponse.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/sessions\/session-created-from-playwright$/, {
    timeout: 10000,
  });

  await waitForRelayConnects(page, 1);
  await waitForRelayFrames(page, 1);

  const relayState = await readRelayState(page);
  expect(relayState.connectCalls).toContainEqual({
    sessionId: "session-created-from-playwright",
    workerId: "worker-ui-test",
  });
  expect(relayState.sentFrames[0]?.text).toBe("__ct_init__");

  await emitWorkerText(
    page,
    "session-created-from-playwright",
    "__ct_ready__:/workspace/CortexTerminal\n",
  );
  await expect(page.getByTestId("status")).toHaveText("在线");
});

test("worker install page issues install command", async ({ page }) => {
  await mockAuthenticatedShell(page);
  await page.goto("/");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "安装 Worker" }).click();

  await expect(
    page.getByRole("heading", { name: "安装 Worker" }),
  ).toBeVisible();

  await expect(
    page.getByText(/install-worker\.sh\?token=iwk_PLAYWR1/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Windows" }).click();

  await expect(
    page.getByText(/install-worker\.ps1\?token=iwk_PLAYWR1/),
  ).toBeVisible();
});

test("missing session route redirects home with clear error", async ({
  page,
}) => {
  await mockAuthenticatedShell(page, {
    sessions: [],
  });

  await page.goto("/sessions/missing-session");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(
    page.getByText("目标会话不存在、已被删除，或当前用户无权访问该会话。"),
  ).toBeVisible();
});

test("terminal session relays command input through worker session", async ({
  page,
}) => {
  await installMockRelay(page);
  await mockAuthenticatedShell(page);
  await page.goto("/sessions/session-playwright-1");

  await waitForRelayConnects(page, 1);
  await waitForRelayFrames(page, 1);
  await emitWorkerText(
    page,
    "session-playwright-1",
    "__ct_ready__:/workspace/CortexTerminal\n",
  );

  await expect(page.getByTestId("status")).toHaveText("在线");

  await emitWorkerText(
    page,
    "session-playwright-1",
    "__ct_cwd__:/workspace/CortexTerminal/games/snake\n",
  );
  await expect(page.getByText("/workspace/CortexTerminal/games/snake")).toBeVisible();

  await page.getByTestId("command-input").fill("请在当前目录实现一个贪食蛇游戏");
  await page.getByTestId("send").click();

  await waitForRelayFrames(page, 2);

  const relayState = await readRelayState(page);
  expect(relayState.sentFrames[0]?.text).toBe("__ct_init__");
  expect(relayState.sentFrames[1]?.text).toBe(
    "请在当前目录实现一个贪食蛇游戏",
  );
  expect(relayState.sentFrames[1]?.sessionId).toBe("session-playwright-1");
});

test("terminal session reconnects and reinitializes after relay recovery", async ({
  page,
}) => {
  await installMockRelay(page);
  await mockAuthenticatedShell(page);
  await page.goto("/sessions/session-playwright-1");

  await waitForRelayConnects(page, 1);
  await waitForRelayFrames(page, 1);
  await emitWorkerText(
    page,
    "session-playwright-1",
    "__ct_ready__:/workspace/CortexTerminal\n",
  );

  await expect(page.getByTestId("status")).toHaveText("在线");

  await triggerRelayReconnecting(page, "simulated relay drop");
  await expect(page.getByTestId("status")).toHaveText("重连中");

  await triggerRelayReconnected(page);
  await waitForRelayConnects(page, 2);
  await waitForRelayFrames(page, 2);

  const reconnectState = await readRelayState(page);
  expect(reconnectState.connectCalls).toEqual([
    {
      sessionId: "session-playwright-1",
      workerId: "worker-ui-test",
    },
    {
      sessionId: "session-playwright-1",
      workerId: "worker-ui-test",
    },
  ]);
  expect(
    reconnectState.sentFrames.filter((frame) => frame.text === "__ct_init__"),
  ).toHaveLength(2);

  await emitWorkerText(
    page,
    "session-playwright-1",
    "__ct_ready__:/workspace/CortexTerminal\n",
  );
  await expect(page.getByTestId("status")).toHaveText("在线");
});
