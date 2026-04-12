import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const authFilePath =
  process.env.PLAYWRIGHT_REAL_AUTH_FILE ??
  "/Volumes/MacMiniDisk/Users/echo/.copilot/session-state/f469abff-d367-4c36-a562-17fa89ee2bc3/files/local-e2e-auth.json";
const workerId =
  process.env.PLAYWRIGHT_REAL_WORKER_ID ?? "playwright-worker-local";
const baseUrl = process.env.PLAYWRIGHT_REAL_BASE_URL ?? "http://127.0.0.1:4173";
const gatewayUrl = process.env.PLAYWRIGHT_REAL_GATEWAY_URL ?? "http://127.0.0.1:5050";
const filesRootPath =
  process.env.PLAYWRIGHT_REAL_FILES_ROOT ??
  "/Volumes/MacMiniDisk/Users/echo/.copilot/session-state/f469abff-d367-4c36-a562-17fa89ee2bc3/files";
const repoPath =
  process.env.PLAYWRIGHT_REAL_REPO_PATH ??
  "/Volumes/MacMiniDisk/workspace/CortexTerminal ";
const reportFilePath =
  process.env.PLAYWRIGHT_REAL_REPORT_FILE ??
  "/Volumes/MacMiniDisk/Users/echo/.copilot/session-state/f469abff-d367-4c36-a562-17fa89ee2bc3/files/real-session-harness-report.json";
const runId = `real-harness-${Date.now()}`;
const snakeFileRelativePath = `${runId}-snake.html`;
const calculatorFileRelativePath = `${runId}-calculator.js`;
const mazeFileRelativePath = `${runId}-maze.js`;
const stopwatchFileRelativePath = `${runId}-stopwatch.html`;
const countdownFileRelativePath = `${runId}-countdown.html`;
const snakeFileAbsolutePath = path.join(filesRootPath, snakeFileRelativePath);
const calculatorFileAbsolutePath = path.join(filesRootPath, calculatorFileRelativePath);
const mazeFileAbsolutePath = path.join(filesRootPath, mazeFileRelativePath);
const stopwatchFileAbsolutePath = path.join(filesRootPath, stopwatchFileRelativePath);
const countdownFileAbsolutePath = path.join(filesRootPath, countdownFileRelativePath);

const auth = readJson(authFilePath);
const trackedSessionIds = new Set();
let managementAccessToken = null;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitFor(condition, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await condition();
    if (lastValue) {
      return lastValue;
    }
    await sleep(500);
  }

  throw new Error(message + (lastValue ? ` (last=${JSON.stringify(lastValue)})` : ""));
}

async function getManagementAccessToken() {
  if (managementAccessToken) {
    return managementAccessToken;
  }

  const response = await fetch(`${gatewayUrl}/connect/token`, {
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

  managementAccessToken = (await response.json()).access_token;
  return managementAccessToken;
}

async function managementFetch(url, init = {}) {
  const accessToken = await getManagementAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  return response;
}

async function listSessions() {
  const response = await managementFetch(`${gatewayUrl}/api/sessions`);
  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.status}`);
  }

  return response.json();
}

async function listWorkers() {
  const response = await managementFetch(`${gatewayUrl}/api/workers`);
  if (!response.ok) {
    throw new Error(`Failed to list workers: ${response.status}`);
  }

  return response.json();
}

async function closeSession(sessionId) {
  const response = await managementFetch(
    `${gatewayUrl}/api/sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to close session ${sessionId}: ${response.status}`);
  }
}

async function leaveSessionPage(page) {
  if (!page || page.isClosed()) {
    return;
  }

  await page
    .goto(`${baseUrl}/`, {
      waitUntil: "commit",
      timeout: 10_000,
    })
    .catch(() => undefined);
}

async function closeSessionGracefully(page, sessionId) {
  console.log(`[session:close:start] ${sessionId}`);
  await leaveSessionPage(page);
  console.log(`[session:close:left-page] ${sessionId}`);
  await closeSession(sessionId);
  console.log(`[session:close:done] ${sessionId}`);
}

async function waitForSessionState(sessionId, expectedState, timeoutMs = 120_000) {
  return waitFor(
    async () => {
      const session = (await listSessions()).find((candidate) => candidate.sessionId === sessionId);
      return session?.state === expectedState ? session : null;
    },
    timeoutMs,
    `Timed out waiting for session ${sessionId} to reach ${expectedState}`,
  );
}

async function waitForWorkerOnline(timeoutMs = 30_000) {
  return waitFor(
    async () => {
      const worker = (await listWorkers()).find((candidate) => candidate.workerId === workerId);
      return worker?.isOnline ? worker : null;
    },
    timeoutMs,
    `Timed out waiting for worker ${workerId} to be online`,
  );
}

async function newPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  return { context, page };
}

async function cleanupContext(context) {
  await context.close().catch(() => undefined);
}

async function login(page) {
  await page.goto(`${baseUrl}/`);
  const dashboardHeading = page.getByRole("heading", { name: "工作台" });
  if (await dashboardHeading.isVisible().catch(() => false)) {
    return;
  }

  await page.getByPlaceholder("echo").fill(auth.username);
  await page.getByPlaceholder("••••••••").fill(auth.password);
  await page.getByRole("button", { name: "登录并进入" }).click();
  await dashboardHeading.waitFor({ state: "visible", timeout: 60_000 });
}

async function createSessionViaUi(page, pathChoice) {
  const normalizedPathChoice = pathChoice.trimEnd();
  const sessionsBeforeCreate = new Set((await listSessions()).map((session) => session.sessionId));

  await page.goto(`${baseUrl}/`);
  await page.getByRole("heading", { name: "工作台" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "新建会话" }).click();
  await page.getByRole("heading", { name: "创建会话" }).waitFor({ state: "visible" });
  await page
    .getByRole("combobox", { name: "执行节点" })
    .filter({ hasText: "Playwright Local Claude Worker" })
    .waitFor({ state: "visible" });

  const browseDirectoriesButton = page.getByRole("button", { name: /真实目录/ });
  await browseDirectoriesButton.click();
  await page.getByRole("dialog", { name: "选择工作目录" }).waitFor({ state: "visible" });
  await page
    .getByRole("button", {
      name: new RegExp(`选择目录 ${escapeRegex(normalizedPathChoice)}\\s*$`),
    })
    .click();

  const createButton = page.getByRole("button", { name: "创建并进入终端" });
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/sessions") &&
      response.status() === 201,
  );

  await createButton.click();
  const createResponseBody = await (await createResponse).json().catch(() => null);

  const createdSessionId = await waitFor(
    async () => {
      if (createResponseBody?.sessionId) {
        return createResponseBody.sessionId;
      }

      const createdSession = (await listSessions()).find(
        (session) => !sessionsBeforeCreate.has(session.sessionId),
      );
      if (createdSession?.sessionId) {
        return createdSession.sessionId;
      }

      const sessionMatch = page.url().match(/\/sessions\/([^/?#]+)$/)?.[1];
      if (sessionMatch && sessionMatch !== "new") {
        return decodeURIComponent(sessionMatch);
      }
      return null;
    },
    30_000,
    "Timed out waiting for created session id",
  );

  trackedSessionIds.add(createdSessionId);
  console.log(`[session:create:id] ${createdSessionId}`);

  const sessionRoute = `${baseUrl}/sessions/${encodeURIComponent(createdSessionId)}`;
  await waitFor(
    async () => page.url().includes(`/sessions/${createdSessionId}`),
    15_000,
    `Timed out waiting for session route ${createdSessionId}`,
  ).catch(async () => {
    console.log(`[session:create:force-route] ${createdSessionId}`);
    await page.goto(sessionRoute, { waitUntil: "domcontentloaded" });
  });

  try {
    console.log(`[session:create:wait-active] ${createdSessionId}`);
    await waitForSessionState(createdSessionId, "Active", 30_000);
  } catch {
    console.log(`[session:create:retry-active] ${createdSessionId}`);
    await page.goto(sessionRoute, { waitUntil: "domcontentloaded" });
    await waitForSessionState(createdSessionId, "Active", 90_000);
  }

  console.log(`[session:create:active] ${createdSessionId}`);
  return createdSessionId;
}

async function sendPrompt(page, prompt) {
  await page.waitForTimeout(4_000);
  await page.getByTestId("command-input").fill(prompt);
  await page.getByTestId("send").click();
  await page.waitForTimeout(2_000);

  const transcript = await page.locator(".xterm-rows").textContent().catch(() => "");
  if (transcript.includes("Relay 正在连接中，请稍候再发送。")) {
    console.log("[prompt:retry] attempt=1");
    await page.waitForTimeout(4_000);
    await page.getByTestId("command-input").fill(prompt);
    await page.getByTestId("send").click();
  }
}

async function autoApproveInteractivePrompt(page) {
  const affirmativeButton = page
    .getByRole("button", {
      name: /don't ask again|yes|allow|approve|proceed|continue/i,
    })
    .first();

  const isVisible = await affirmativeButton.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }

  const label = (await affirmativeButton.textContent().catch(() => ""))?.trim() ?? "";
  console.log(`[prompt:auto-approve] ${label}`);
  await affirmativeButton.click();
  return true;
}

async function verifyWithInteractivePrompts(page, verify) {
  const verification = (async () => {
    await verify();
    return { ok: true };
  })().catch((error) => ({ ok: false, error }));

  while (true) {
    const result = await Promise.race([
      verification,
      page.waitForTimeout(2_000).then(() => null),
    ]);

    if (result) {
      if (!result.ok) {
        throw result.error;
      }

      return;
    }

    await autoApproveInteractivePrompt(page);
  }
}

function logCase(status, name, error) {
  const prefix = status === "start" ? "[case:start]" : status === "passed" ? "[case:pass]" : "[case:fail]";
  console.log(`${prefix} ${name}`);
  if (error) {
    console.log(String(error));
  }
}

async function runProgramCase(browser, name, prompt, verify) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    logCase("start", attempt === 1 ? name : `${name} (retry ${attempt})`);
    const { context, page } = await newPage(browser);
    let sessionId = null;
    try {
      await login(page);
      sessionId = await createSessionViaUi(page, filesRootPath);
      await sendPrompt(page, prompt);
      await verifyWithInteractivePrompts(page, verify);
      await closeSessionGracefully(page, sessionId);
      trackedSessionIds.delete(sessionId);
      logCase("passed", name);
      return { name, status: "passed" };
    } catch (error) {
      lastError = error;
      const transcript = await page.locator(".xterm-rows").textContent().catch(() => "");
      if (transcript) {
        console.log("[program:transcript]");
        console.log(transcript);
      }

      if (attempt === 2) {
        logCase("failed", name, error.stack ?? error);
        return { name, status: "failed", error: String(error.stack ?? error) };
      }

      console.log(`[program:retry] ${name}`);
    } finally {
      if (sessionId) {
        await closeSessionGracefully(page, sessionId).catch(() => undefined);
        trackedSessionIds.delete(sessionId);
      }
      await cleanupContext(context);
    }
  }

  return { name, status: "failed", error: String(lastError ?? "Unknown program failure") };
}

async function runCase(browser, name, callback) {
  logCase("start", name);
  const { context, page } = await newPage(browser);
  try {
    await callback({ page, context });
    logCase("passed", name);
    return { name, status: "passed" };
  } catch (error) {
    logCase("failed", name, error.stack ?? error);
    return { name, status: "failed", error: String(error.stack ?? error) };
  } finally {
    await cleanupContext(context);
  }
}

async function closeTrackedSessions() {
  const sessions = await listSessions();
  await Promise.all(
    sessions
      .filter((session) => trackedSessionIds.has(session.sessionId))
      .map(async (session) => {
        await closeSession(session.sessionId).catch(() => undefined);
      }),
  );
  trackedSessionIds.clear();
}

async function closeAllSessions() {
  const sessions = await listSessions();
  await Promise.all(
    sessions.map(async (session) => {
      await closeSession(session.sessionId).catch(() => undefined);
    }),
  );
}

async function main() {
  await waitForWorkerOnline();
  await closeAllSessions();
  const browser = await chromium.launch({ headless: false });
  const results = [];

  try {
    results.push(
      await runCase(browser, "real auth screen appears when signed out", async ({ page }) => {
        await page.goto(`${baseUrl}/`);
        await page.getByRole("heading", { name: "CORTEX TERMINAL" }).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "real invalid login is rejected", async ({ page }) => {
        await page.goto(`${baseUrl}/`);
        await page.getByPlaceholder("echo").fill(auth.username);
        await page.getByPlaceholder("••••••••").fill(`${auth.password}x`);
        await page.getByRole("button", { name: "登录并进入" }).click();
        await page.getByText(/username\/password combination is invalid/i).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "real user can log in through mobile", async ({ page }) => {
        await login(page);
        await page
          .getByRole("button", { name: /Playwright Local Claude Worker/i })
          .first()
          .waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "real auth session survives reload", async ({ page }) => {
        await login(page);
        await page.reload();
        await page.getByRole("heading", { name: "工作台" }).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "dashboard shows local worker online", async ({ page }) => {
        await login(page);
        await page
          .getByRole("button", { name: /Playwright Local Claude Worker/i })
          .first()
          .waitFor({ state: "visible" });
        await page.getByText("可立即进入").first().waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "settings route opens", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "设置", exact: true }).click();
        await waitFor(
          async () => page.url().endsWith("/settings"),
          30_000,
          "Settings route did not open",
        );
      }),
    );

    results.push(
      await runCase(browser, "worker install page loads unix command", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "设置", exact: true }).click();
        await page.getByRole("button", { name: "安装 Worker" }).click();
        await page.getByText(/install-worker\.sh\?token=/).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "worker install page switches to windows command", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "设置", exact: true }).click();
        await page.getByRole("button", { name: "安装 Worker" }).click();
        await page.getByRole("button", { name: "Windows" }).click();
        await page.getByText(/install-worker\.ps1\?token=/).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "new session page shows real worker and repo path", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "新建会话" }).click();
        await page.getByRole("heading", { name: "创建会话" }).waitFor({ state: "visible" });
        await page.getByRole("button", { name: /真实目录/ }).waitFor({ state: "visible" });
        await page.locator("div.mt-2.break-all.font-mono.text-\\[12px\\].text-cyan-300").waitFor({ state: "visible" });
        const previewText = await page.locator("div.mt-2.break-all.font-mono.text-\\[12px\\].text-cyan-300").textContent();
        assert(previewText?.includes(repoPath), "Repo path preview mismatch");
      }),
    );

    results.push(
      await runCase(browser, "new session page has no display name input", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "新建会话" }).click();
        await page.getByRole("heading", { name: "创建会话" }).waitFor({ state: "visible" });
        assert(
          (await page.getByPlaceholder(/session/i).count().catch(() => 0)) === 0,
          "Display name input should not exist",
        );
      }),
    );

    results.push(
      await runCase(browser, "directory picker lists repo root", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "新建会话" }).click();
        await page.getByRole("button", { name: /真实目录/ }).click();
        await page
          .getByRole("button", {
            name: new RegExp(`选择目录 ${escapeRegex(repoPath.trimEnd())}\\s*$`),
          })
          .waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "directory picker expands repo child folder", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "新建会话" }).click();
        await page.getByRole("button", { name: /真实目录/ }).click();
        await page
          .getByRole("button", {
            name: new RegExp(`展开 ${escapeRegex(repoPath.trimEnd())}\\s*$`),
          })
          .click();
        await page.getByRole("button", { name: /选择目录 .*\/mobile$/ }).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "create repo session becomes active", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "created repo session appears on home and reopens", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await page.getByRole("button", { name: "back to home" }).click();
        await page.getByText(sessionId).first().waitFor({ state: "visible" });
        await page
          .getByRole("button", { name: new RegExp(escapeRegex(sessionId)) })
          .first()
          .click({ noWaitAfter: true });
        await waitFor(
          async () => page.url().endsWith(`/sessions/${sessionId}`),
          30_000,
          "Reopen did not navigate to session route",
        );
        await waitForSessionState(sessionId, "Active");
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "terminal route reload reattaches active session", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await page.reload({ waitUntil: "domcontentloaded" }).catch((error) => {
          if (!String(error).includes("ERR_ABORTED")) {
            throw error;
          }
        });
        await waitFor(
          async () => page.url().endsWith(`/sessions/${sessionId}`),
          30_000,
          "Reload did not stay on session route",
        );
        await waitForSessionState(sessionId, "Active");
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "missing session route redirects home with error", async ({ page }) => {
        await login(page);
        await page.goto(`${baseUrl}/sessions/${runId}-missing-session`);
        await waitFor(async () => page.url() === `${baseUrl}/`, 30_000, "Missing session did not redirect home");
        await page.getByText("目标会话不存在、已被删除，或当前用户无权访问该会话。").waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "files root session becomes active", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, filesRootPath);
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "session can be deleted from home", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await page.getByRole("button", { name: "back to home" }).click();
        await page.getByRole("button", { name: `delete ${sessionId}` }).click();
        await waitFor(
          async () => !(await listSessions()).some((session) => session.sessionId === sessionId),
          30_000,
          "Session delete did not propagate",
        );
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "audit page filters worker records", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "审计", exact: true }).click();
        await page.getByRole("button", { name: /^worker$/ }).first().click();
        await page.getByText(`worker: ${workerId}`).first().waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "audit page searches created session id", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await page.getByRole("button", { name: "back to home" }).click();
        await page.getByRole("button", { name: "审计", exact: true }).click();
        await page.getByPlaceholder("搜索 session / worker / trace / summary").fill(sessionId);
        await page.getByText(`session: ${sessionId}`).first().waitFor({ state: "visible" });
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "logout returns to auth screen", async ({ page }) => {
        await login(page);
        await page.getByRole("button", { name: "设置", exact: true }).click();
        await page.getByRole("button", { name: "退出登录" }).click();
        await page.getByRole("heading", { name: "CORTEX TERMINAL" }).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "user can log in again after logout", async ({ page }) => {
        await page.goto(`${baseUrl}/`);
        await page.getByPlaceholder("echo").fill(auth.username);
        await page.getByPlaceholder("••••••••").fill(auth.password);
        await page.getByRole("button", { name: "登录并进入" }).click();
        await page.getByRole("heading", { name: "工作台" }).waitFor({ state: "visible" });
      }),
    );

    results.push(
      await runCase(browser, "two repo sessions can become active sequentially", async ({ page }) => {
        await login(page);
        const first = await createSessionViaUi(page, repoPath);
        await page.goto(`${baseUrl}/`);
        const second = await createSessionViaUi(page, repoPath);
        assert(first !== second, "Sequential sessions should have distinct ids");
        await closeSessionGracefully(page, first);
        await closeSessionGracefully(page, second);
        trackedSessionIds.delete(first);
        trackedSessionIds.delete(second);
      }),
    );

    results.push(
      await runCase(browser, "direct route to existing active session works", async ({ page, context }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        const secondPage = await context.newPage();
        secondPage.setDefaultTimeout(60_000);
        await secondPage.goto(`${baseUrl}/sessions/${sessionId}`);
        await waitForSessionState(sessionId, "Active");
        await secondPage.close();
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
      }),
    );

    results.push(
      await runCase(browser, "closed session route redirects home", async ({ page }) => {
        await login(page);
        const sessionId = await createSessionViaUi(page, repoPath);
        await closeSessionGracefully(page, sessionId);
        trackedSessionIds.delete(sessionId);
        await page.goto(`${baseUrl}/sessions/${sessionId}`);
        await waitFor(async () => page.url() === `${baseUrl}/`, 30_000, "Closed session did not redirect home");
      }),
    );

    results.push(
      await runProgramCase(
        browser,
        "Claude generates Snake game",
        [
          `In the current working directory, create ${snakeFileRelativePath} as a fully self-contained Snake game.`,
          "Requirements:",
          "1. Single HTML file with embedded CSS and JavaScript.",
          "2. Show visible text 'Score'.",
          "3. Support keyboard arrow keys.",
          "4. Include restart behavior after game over.",
          `5. The final file path must be exactly ./${snakeFileRelativePath}. Do not use any other filename.`,
          "6. Create or overwrite the file and finish without follow-up questions.",
        ].join("\n"),
        async () => {
          await waitFor(() => fs.existsSync(snakeFileAbsolutePath), 180_000, "Snake file was not created");
          const html = fs.readFileSync(snakeFileAbsolutePath, "utf8");
          assert(html.includes("Score"), "Snake html missing Score");
        },
      ),
    );

    results.push(
      await runProgramCase(
        browser,
        "Claude generates calculator CLI",
        [
          `Create ${calculatorFileRelativePath} in the current working directory.`,
          `It must be a Node.js CLI calculator with usage: node ${calculatorFileRelativePath} add 2 3`,
          "Support add, sub, mul, and div.",
          "Print only the numeric result.",
          `Use exactly the filename ${calculatorFileRelativePath}.`,
          "Create or overwrite the file and finish without follow-up questions.",
        ].join("\n"),
        async () => {
          await waitFor(() => fs.existsSync(calculatorFileAbsolutePath), 180_000, "Calculator file was not created");
          const output = execFileSync("node", [calculatorFileAbsolutePath, "add", "2", "3"], {
            encoding: "utf8",
          }).trim();
          assert(output === "5", `Calculator output mismatch: ${output}`);
        },
      ),
    );

    results.push(
      await runProgramCase(
        browser,
        "Claude generates maze CLI",
        [
          `Create ${mazeFileRelativePath} as a Node.js ASCII maze generator.`,
          "Requirements:",
          `1. Usage: node ${mazeFileRelativePath} 7 5 --seed 42`,
          "2. Output at least five lines using # and spaces.",
          "3. Deterministic output for the same seed.",
          `4. The final file path must be exactly ./${mazeFileRelativePath}.`,
          "5. Create or overwrite the file and finish without follow-up questions.",
        ].join("\n"),
        async () => {
          await waitFor(() => fs.existsSync(mazeFileAbsolutePath), 180_000, "Maze file was not created");
          const lines = execFileSync("node", [mazeFileAbsolutePath, "7", "5", "--seed", "42"], {
            encoding: "utf8",
          })
            .trim()
            .split("\n");
          assert(lines.length >= 5, "Maze output too short");
        },
      ),
    );

    results.push(
      await runProgramCase(
        browser,
        "Claude generates stopwatch web app",
        [
          `Create ${stopwatchFileRelativePath} as a self-contained stopwatch web app.`,
          "Requirements:",
          "1. Single HTML file with embedded CSS and JavaScript.",
          "2. Visible Start, Stop, and Reset buttons.",
          "3. Visible timer display.",
          `4. The final file path must be exactly ./${stopwatchFileRelativePath}.`,
          "5. Create or overwrite the file and finish without follow-up questions.",
        ].join("\n"),
        async () => {
          await waitFor(() => fs.existsSync(stopwatchFileAbsolutePath), 180_000, "Stopwatch file was not created");
          const html = fs.readFileSync(stopwatchFileAbsolutePath, "utf8");
          assert(html.includes("Start"), "Stopwatch html missing Start");
          assert(html.includes("Stop"), "Stopwatch html missing Stop");
          assert(html.includes("Reset"), "Stopwatch html missing Reset");
        },
      ),
    );

      results.push(
        await runProgramCase(
          browser,
          "Claude generates countdown web app",
          [
            `Create ${countdownFileRelativePath} as a self-contained countdown timer web app.`,
            "Requirements:",
            "1. Single HTML file with embedded CSS and JavaScript.",
            "2. Visible timer display and Start, Pause, Reset buttons.",
            "3. Allow setting the countdown seconds before starting.",
            `4. The final file path must be exactly ./${countdownFileRelativePath}.`,
            "5. Create or overwrite the file and finish without follow-up questions.",
          ].join("\n"),
          async () => {
            await waitFor(() => fs.existsSync(countdownFileAbsolutePath), 180_000, "Countdown file was not created");
            const html = fs.readFileSync(countdownFileAbsolutePath, "utf8");
            assert(html.includes("Start"), "Countdown html missing Start");
            assert(html.includes("Pause"), "Countdown html missing Pause");
            assert(html.includes("Reset"), "Countdown html missing Reset");
          },
        ),
      );
  } finally {
    await closeTrackedSessions();
    await browser.close().catch(() => undefined);
  }

  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };

  fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
