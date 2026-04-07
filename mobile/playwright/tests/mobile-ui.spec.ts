import { expect, test } from "@playwright/test";

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
        displayName: payload.displayName,
        workingDirectory: payload.workingDirectory,
        state: "Active",
        mobileConnectionId: null,
        traceId: payload.traceId,
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

  await page.route("**/api/auth/worker/device/activate", async (route) => {
    const payload = route.request().postDataJSON() as { userCode: string };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workerId: "worker-paired-ui-test",
        displayName: "Paired Worker",
        userCode: payload.userCode,
        approvedBy: principal.subject,
        approvedAtUtc: "2026-04-07T10:09:00Z",
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

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();

  await page.getByRole("button", { name: "查看审计记录" }).click();
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
  await mockAuthenticatedShell(page);
  await page.goto("/sessions/new");

  await expect(page.getByRole("heading", { name: "创建会话" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "执行节点" })).toContainText(
    "Worker UI Test",
  );
  await expect(page.getByRole("combobox", { name: "工作目录" })).toContainText(
    "/workspace/CortexTerminal",
  );

  await page.getByRole("textbox").fill("Playwright Created Session");
  await page.getByRole("button", { name: "创建并进入终端" }).click();

  await expect(page).toHaveURL(/\/sessions\/session-created-from-playwright$/);
  await expect(page.getByTestId("status")).toContainText(
    /CONNECTING|ERROR|CONNECTED/,
  );
  await expect(page.getByTestId("terminal-output")).toBeVisible();
  await expect(page.getByTestId("command-input")).toBeVisible();
});

test("worker pairing flow shows success message", async ({ page }) => {
  await mockAuthenticatedShell(page);
  await page.goto("/settings/pair-worker");

  await expect(
    page.getByRole("heading", { name: "配对 Worker Device" }),
  ).toBeVisible();

  await page.getByPlaceholder("ABCD-EFGH").fill("pair-1234");
  await page.getByRole("button", { name: "授权节点" }).click();

  await expect(
    page.getByText(/Worker Paired Worker \(worker-paired-ui-test\) 已授权/),
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
