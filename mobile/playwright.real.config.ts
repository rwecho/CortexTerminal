import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright/tests",
  testMatch: "**/*.real.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: {
    timeout: 60_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: false,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
