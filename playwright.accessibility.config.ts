import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT ?? 9159);
export default defineConfig({
  testDir: "test/e2e",
  testMatch: ["accessibility.spec.ts", "accessibility-routes.spec.ts", "accessibility-api.spec.ts"],
  workers: 2,
  forbidOnly: !!process.env.CI,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `E2E_PORT=${port} node test/e2e/serve.mjs`,
    url: `http://127.0.0.1:${port}/api/videos`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
