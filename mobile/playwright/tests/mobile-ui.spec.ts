import { expect, test } from "@playwright/test";

test("can login and relay command with real backend", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "鉴权并进入" }).click();
  await page.getByRole("button", { name: "Server AGemini 2.5" }).click();

  await expect(page.getByTestId("status")).toContainText("CONNECTED");

  await page.getByTestId("command-input").fill("ls -la");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("terminal-output")).toContainText("ls -la");
  await expect(page.getByTestId("terminal-output")).toContainText(
    "worker:worker-1 echo => ls -la",
  );
});
