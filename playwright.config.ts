import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  projects: (process.env.E2E_ALL_BROWSERS === "true"
    ? ["chromium", "firefox", "webkit"]
    : ["chromium"]
  ).map((name) => ({
    name,
    use: { browserName: name as "chromium" | "firefox" | "webkit" },
  })),
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3217", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 3217",
    url: "http://127.0.0.1:3217",
    reuseExistingServer: false,
    timeout: 120000,
    env: { APP_ORIGIN: "http://127.0.0.1:3217", DATA_DIR: ".data/e2e" },
  },
});
