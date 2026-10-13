import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT ?? 9161);
export default defineConfig({
  testDir: "test/e2e",
  snapshotPathTemplate: "{testDir}/visual/{arg}{ext}",
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 2,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `E2E_PORT=${port} node test/e2e/serve.mjs`,
      // Videos is the last seeded catalog key; 200 confirms fixture population.
      url: `http://127.0.0.1:${port}/api/videos`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `E2E_PORT=${port + 1} E2E_UPSTREAM_FAILURE=1 node test/e2e/serve.mjs`,
      url: `http://127.0.0.1:${port + 1}/about`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
