import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Smoke tests run against the production Worker bundle (`dist/server`) served
// locally by wrangler, not the Vite dev server. `bun run preview` can't serve
// this Cloudflare build (it looks for dist/server/server.js).
export default defineConfig({
  testDir: "test/e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run build && bunx wrangler dev -c dist/server/wrangler.json --local --port ${PORT}`,
    url: `http://localhost:${PORT}/about`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
