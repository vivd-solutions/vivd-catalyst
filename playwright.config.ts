import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command:
        "HOST=127.0.0.1 PORT=4100 CLIENT_CONFIG_PATH=tests/fixtures/e2e-app.yaml node clients/demo/dist/server.js",
      url: "http://127.0.0.1:4100/health",
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command:
        "pnpm --filter @agent-chat-platform/chat-standalone preview --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});
