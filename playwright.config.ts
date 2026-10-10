import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Smoke tests run against the production Worker bundle (`dist/server`, so build
// first: `bun run test:e2e` does) served locally by wrangler with a KV seeded from
// recorded fixtures. `bun run preview` can't serve this Cloudflare build (it looks
// for dist/server/server.js).
export default defineConfig({
  testDir: "test/e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun test/e2e/seed-kv.ts && bunx wrangler dev -c dist/server/wrangler.json --local --port ${PORT} --persist-to .wrangler/e2e`,
    url: `http://localhost:${PORT}/about`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
