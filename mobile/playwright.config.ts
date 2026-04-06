import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright/tests",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
