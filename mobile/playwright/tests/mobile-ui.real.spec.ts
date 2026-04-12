import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const authFilePath =
  process.env.PLAYWRIGHT_REAL_AUTH_FILE ??
  "/Volumes/MacMiniDisk/Users/echo/.copilot/session-state/f469abff-d367-4c36-a562-17fa89ee2bc3/files/local-e2e-auth.json";
const workerId =
  process.env.PLAYWRIGHT_REAL_WORKER_ID ?? "playwright-worker-local";
const repoPath =
  process.env.PLAYWRIGHT_REAL_REPO_PATH ?? path.resolve(process.cwd(), "..");
const filesRootPath =
  process.env.PLAYWRIGHT_REAL_FILES_ROOT ??
  "/Volumes/MacMiniDisk/Users/echo/.copilot/session-state/f469abff-d367-4c36-a562-17fa89ee2bc3/files";
const runId = `real-e2e-${Date.now()}`;
const programRootRelativePath = path.posix.join("claude-e2e-programs", runId);
const programRootAbsolutePath = path.join(filesRootPath, "claude-e2e-programs", runId);

type AuthFixture = {
  username: string;
  password: string;
  accessToken: string;
  refreshToken?: string;
  workerKey: string;
};

type SessionSnapshot = {
  sessionId: string;
  displayName?: string | null;
  workerId?: string | null;
  workingDirectory?: string | null;
  state: string;
  isActive: boolean;
};

const auth = readAuthFixture();
const trackedSessionIds = new Set<string>();
let managementAccessToken: string | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  fs.mkdirSync(programRootAbsolutePath, { recursive: true });
  await closeTrackedSessions();
});

test.afterAll(async () => {
  await closeTrackedSessions();
});

test("real auth screen appears when signed out", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "CORTEX TERMINAL" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "登录并进入" })).toBeVisible();
});

test("real invalid login is rejected", async ({ page }) => {
  await page.goto("/");
  await fillLoginForm(page, auth.username, `${auth.password}x`);
  await page.getByRole("button", { name: "登录并进入" }).click();

  await expect(
    page.getByText(/username\/password combination is invalid/i),
  ).toBeVisible();
});

test("real user can log in through mobile", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(page.getByText("Playwright Local Claude Worker")).toBeVisible();
});

test("real auth session survives reload", async ({ page }) => {
  await login(page);
  await page.reload();

  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(page.getByText("Playwright Local Claude Worker")).toBeVisible();
});

test("dashboard shows the local worker online", async ({ page }) => {
  await login(page);

  await expect(
    page.getByRole("button", { name: /Playwright Local Claude Worker/i }),
  ).toBeVisible();
  await expect(page.getByText("可立即进入")).toBeVisible();
});

test("settings route opens in real environment", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
});

test("worker install page auto-loads unix install command", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "安装 Worker" }).click();

  await expect(
    page.getByRole("heading", { name: "安装 Worker" }),
  ).toBeVisible();
  await expect(page.getByText(/install-worker\.sh\?token=/)).toBeVisible();
});

test("worker install page switches to Windows command", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "安装 Worker" }).click();
  await page.getByRole("button", { name: "Windows" }).click();

  await expect(page.getByText(/install-worker\.ps1\?token=/)).toBeVisible();
});

test("new session page shows real worker and repo path", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "新建会话" }).click();

  await expect(page.getByRole("heading", { name: "创建会话" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "执行节点" })).toContainText(
    "Playwright Local Claude Worker",
  );
  await expect(page.getByRole("button", { name: /真实目录/ })).toBeVisible();
  await expect(
    page.locator("div.mt-2.break-all.font-mono.text-\\[12px\\].text-cyan-300"),
  ).toContainText(
    repoPath,
  );
});

test("real Claude repo session becomes online", async ({ page }) => {
  await login(page);

  const session = await createSessionViaUi(page, {
    pathChoice: repoPath,
  });

  expect(session.sessionId).not.toHaveLength(0);
  await closeSession(session.sessionId);
  trackedSessionIds.delete(session.sessionId);
  await page.goto("/");
});

test("created repo session appears on home and can be reopened", async ({
  page,
}) => {
  await login(page);

  const session = await createSessionViaUi(page, {
    pathChoice: repoPath,
  });

  await page.getByRole("button", { name: "back to home" }).click();
  await expect(page.getByText(session.sessionId)).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(escapeRegex(session.sessionId)) })
    .first()
    .click();

  await waitForTerminalOnline(page);
});

test("terminal route reload reattaches the real session", async ({ page }) => {
  await login(page);

  const session = await createSessionViaUi(page, {
    pathChoice: repoPath,
  });

  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(`/sessions/${escapeRegex(session.sessionId)}$`),
  );
  await waitForTerminalOnline(page);
  await closeSession(session.sessionId);
  trackedSessionIds.delete(session.sessionId);
  await page.goto("/");
});

test("missing session route redirects home with real error", async ({ page }) => {
  await login(page);
  await page.goto(`/sessions/${runId}-missing-session`);

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText("目标会话不存在、已被删除，或当前用户无权访问该会话。"),
  ).toBeVisible();
});

test("real session can use files path and connect online", async ({ page }) => {
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });
});

test("real session can be deleted from home", async ({ page }) => {
  await login(page);

  const session = await createSessionViaUi(page, {
    pathChoice: repoPath,
  });

  await page.getByRole("button", { name: "back to home" }).click();
  await expect(page.getByText(session.sessionId)).toBeVisible();
  await page
    .getByRole("button", { name: `delete ${session.sessionId}` })
    .click();

  await expect(page.getByText(session.sessionId)).toHaveCount(0);
  trackedSessionIds.delete(session.sessionId);
});

test("audit page filters real worker records", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "审计", exact: true }).click();

  await expect(page.getByRole("heading", { name: "审计" })).toBeVisible();
  await page.getByRole("button", { name: "worker" }).click();
  await expect(page.getByText("playwright-worker-local")).toBeVisible();
});

test("audit page can search a created session id", async ({ page }) => {
  await login(page);

  const session = await createSessionViaUi(page, {
    pathChoice: repoPath,
  });

  await page.getByRole("button", { name: "back to home" }).click();
  await page.getByRole("button", { name: "审计", exact: true }).click();
  await page
    .getByPlaceholder("搜索 session / worker / trace / summary")
    .fill(session.sessionId);

  await expect(page.getByText(session.sessionId)).toBeVisible();
});

test("real logout returns to auth screen", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "退出登录" }).click();

  await expect(
    page.getByRole("heading", { name: "CORTEX TERMINAL" }),
  ).toBeVisible();
});

test("real user can log in again after logout", async ({ page }) => {
  await page.goto("/");
  await login(page);

  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
});

test("Claude can generate a Snake game through a real session", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });

  const snakeFile = path.join(programRootAbsolutePath, "snake", "index.html");
  await sendPrompt(
    page,
    [
      `In the current working directory, create ${programRootRelativePath}/snake/index.html as a fully self-contained Snake game.`,
      "Requirements:",
      "1. Single HTML file with embedded CSS and JavaScript.",
      "2. Show visible text 'Score'.",
      "3. Support keyboard arrow keys.",
      "4. Include restart behavior after game over.",
      "5. Create or overwrite the file and finish without asking follow-up questions.",
    ].join("\n"),
  );

  await expect
    .poll(() => fs.existsSync(snakeFile), { timeout: 180_000 })
    .toBe(true);
  const snakeHtml = fs.readFileSync(snakeFile, "utf8");
  expect(snakeHtml).toContain("Score");

  const previewPage = await page.context().newPage();
  await previewPage.goto(`file://${snakeFile}`);
  await expect(previewPage.getByText("Score")).toBeVisible();
  await previewPage.close();
});

test("Claude can generate a calculator CLI through a real session", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });

  const calculatorFile = path.join(programRootAbsolutePath, "calculator.js");
  await sendPrompt(
    page,
    [
      `Create ${programRootRelativePath}/calculator.js as a Node.js CLI calculator.`,
      "Requirements:",
      "1. Usage: node calculator.js add 2 3",
      "2. Support add, sub, mul, div",
      "3. Print only the numeric result",
      "4. Create or overwrite the file and finish without follow-up questions.",
    ].join("\n"),
  );

  await expect
    .poll(() => fs.existsSync(calculatorFile), { timeout: 180_000 })
    .toBe(true);
  const output = execFileSync("node", [calculatorFile, "add", "2", "3"], {
    encoding: "utf8",
  }).trim();
  expect(output).toBe("5");
});

test("Claude can generate a maze CLI through a real session", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });

  const mazeFile = path.join(programRootAbsolutePath, "maze.js");
  await sendPrompt(
    page,
    [
      `Create ${programRootRelativePath}/maze.js as a Node.js ASCII maze generator.`,
      "Requirements:",
      "1. Usage: node maze.js 7 5 --seed 42",
      "2. Output at least five lines of maze text using # and spaces.",
      "3. Deterministic output for the same seed.",
      "4. Create or overwrite the file and finish without follow-up questions.",
    ].join("\n"),
  );

  await expect
    .poll(() => fs.existsSync(mazeFile), { timeout: 180_000 })
    .toBe(true);
  const output = execFileSync("node", [mazeFile, "7", "5", "--seed", "42"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  expect(output.length).toBeGreaterThanOrEqual(5);
});

test("Claude can generate a stopwatch web app through a real session", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });

  const stopwatchFile = path.join(
    programRootAbsolutePath,
    "stopwatch",
    "index.html",
  );
  await sendPrompt(
    page,
    [
      `Create ${programRootRelativePath}/stopwatch/index.html as a self-contained stopwatch web app.`,
      "Requirements:",
      "1. Single HTML file with embedded CSS and JavaScript.",
      "2. Visible Start, Stop, and Reset buttons.",
      "3. Visible timer display.",
      "4. Create or overwrite the file and finish without follow-up questions.",
    ].join("\n"),
  );

  await expect
    .poll(() => fs.existsSync(stopwatchFile), { timeout: 180_000 })
    .toBe(true);

  const previewPage = await page.context().newPage();
  await previewPage.goto(`file://${stopwatchFile}`);
  await expect(previewPage.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(previewPage.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect(previewPage.getByRole("button", { name: "Reset" })).toBeVisible();
  await previewPage.close();
});

test("Claude can generate a todo CLI through a real session", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await login(page);

  await createSessionViaUi(page, {
    pathChoice: filesRootPath,
  });

  const todoFile = path.join(programRootAbsolutePath, "todo.js");
  const todoStore = path.join(programRootAbsolutePath, "todo-data.json");
  if (fs.existsSync(todoStore)) {
    fs.unlinkSync(todoStore);
  }

  await sendPrompt(
    page,
    [
      `Create ${programRootRelativePath}/todo.js as a Node.js todo CLI.`,
      "Requirements:",
      "1. Support commands: add <text>, list, done <id>.",
      "2. Persist data in ./claude-e2e-programs/" + runId + "/todo-data.json",
      "3. Print created item ids and readable list output.",
      "4. Create or overwrite the file and finish without follow-up questions.",
    ].join("\n"),
  );

  await expect
    .poll(() => fs.existsSync(todoFile), { timeout: 180_000 })
    .toBe(true);

  execFileSync("node", [todoFile, "add", "write-tests"], {
    cwd: filesRootPath,
    encoding: "utf8",
  });
  const listOutput = execFileSync("node", [todoFile, "list"], {
    cwd: filesRootPath,
    encoding: "utf8",
  });
  expect(listOutput).toContain("write-tests");
});

function readAuthFixture(): AuthFixture {
  if (!fs.existsSync(authFilePath)) {
    throw new Error(`Missing real auth file: ${authFilePath}`);
  }

  return JSON.parse(fs.readFileSync(authFilePath, "utf8")) as AuthFixture;
}

async function login(page: Page) {
  await page.goto("/");

  if (await page.getByRole("heading", { name: "工作台" }).isVisible().catch(() => false)) {
    return;
  }

  await fillLoginForm(page, auth.username, auth.password);
  await page.getByRole("button", { name: "登录并进入" }).click();
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
}

async function fillLoginForm(page: Page, username: string, password: string) {
  await page.getByPlaceholder("echo").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
}

async function createSessionViaUi(
  page: Page,
  options: {
    pathChoice: string;
    requireOnline?: boolean;
  },
) {
  const normalizedPathChoice = options.pathChoice.trimEnd();
  const sessionsBeforeCreate = new Set(
    (await listSessions()).map((session) => session.sessionId),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await page.getByRole("button", { name: "新建会话" }).click();
  await expect(page.getByRole("heading", { name: "创建会话" })).toBeVisible();

  await expect(page.getByRole("combobox", { name: "执行节点" })).toContainText(
    "Playwright Local Claude Worker",
  );

  const browseDirectoriesButton = page.getByRole("button", { name: /真实目录/ });
  await expect(browseDirectoriesButton).toBeEnabled();
  await browseDirectoriesButton.click();
  await expect(
    page.getByRole("dialog", { name: "选择工作目录" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: new RegExp(`选择目录 ${escapeRegex(normalizedPathChoice)}\\s*$`),
    })
    .click();

  await expect(
    page.locator("div.mt-2.break-all.font-mono.text-\\[12px\\].text-cyan-300"),
  ).toContainText(normalizedPathChoice);
  const createButton = page.getByRole("button", { name: "创建并进入终端" });
  await expect(createButton).toBeEnabled();

  const createSessionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/sessions") &&
      response.status() === 201,
  );
  await createButton.click();
  await createSessionResponse;
  const createdSessionId = await waitForCreatedSessionId(
    page,
    sessionsBeforeCreate,
  );
  const sessionRoutePattern = new RegExp(
    `/sessions/${escapeRegex(createdSessionId)}$`,
  );
  await page.waitForURL(sessionRoutePattern).catch(() => undefined);

  if (options.requireOnline !== false) {
    await waitForTerminalOnline(page, createdSessionId);
  }

  trackedSessionIds.add(createdSessionId);
  return { sessionId: createdSessionId };
}

async function waitForTerminalOnline(
  page: Page,
  sessionId?: string,
  timeout = 120_000,
) {
  const resolvedSessionId =
    sessionId ??
    decodeURIComponent((page.url().split("/sessions/")[1] || "").split(/[?#]/)[0] || "");

  await expect
    .poll(
      async () =>
        (await listSessions()).find((session) => session.sessionId === resolvedSessionId)
          ?.state ?? "missing",
      { timeout },
    )
    .toBe("Active");
}

async function sendPrompt(page: Page, prompt: string) {
  await waitForTerminalOnline(page);
  await page.getByTestId("command-input").fill(prompt);
  await page.getByTestId("send").click();
}

async function closeTrackedSessions() {
  const sessions = await listSessions();
  for (const session of sessions) {
    if (trackedSessionIds.has(session.sessionId)) {
      await closeSession(session.sessionId);
    }
  }
}

async function waitForCreatedSessionId(
  page: Page,
  sessionsBeforeCreate: ReadonlySet<string>,
) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const sessionIdText = (await page
      .getByTestId("session-id")
      .textContent()
      .catch(() => null))?.trim();
    if (sessionIdText) {
      return sessionIdText;
    }

    const sessionMatch = page.url().match(/\/sessions\/([^/?#]+)$/)?.[1];
    if (sessionMatch) {
      return decodeURIComponent(sessionMatch);
    }

    const createdSession = (await listSessions()).find(
      (session) => !sessionsBeforeCreate.has(session.sessionId),
    );
    if (createdSession?.sessionId) {
      return createdSession.sessionId;
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for the created session id.");
}

async function listSessions(): Promise<SessionSnapshot[]> {
  const accessToken = await getManagementAccessToken();
  const response = await fetch("http://127.0.0.1:5050/api/sessions", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.status}`);
  }

  return (await response.json()) as SessionSnapshot[];
}

async function closeSession(sessionId: string) {
  const accessToken = await getManagementAccessToken();
  const response = await fetch(
    `http://127.0.0.1:5050/api/sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to close session ${sessionId}: ${response.status}`);
  }
}

async function getManagementAccessToken() {
  if (managementAccessToken) {
    return managementAccessToken;
  }

  const response = await fetch("http://127.0.0.1:5050/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: auth.username,
      password: auth.password,
      scope: "gateway.api relay.connect offline_access",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get management access token: ${response.status}`);
  }

  const payload = (await response.json()) as { access_token: string };
  managementAccessToken = payload.access_token;
  return managementAccessToken;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
