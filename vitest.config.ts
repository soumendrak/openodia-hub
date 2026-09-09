import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}",
        "scripts/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}",
      ],
      // A Playwright harness: it launches Chromium against a running dev
      // server and asserts on layout, loaded art, contrast and animation
      // timing. Vitest can't run it, and a mocked-browser unit test would
      // assert nothing real. Run it with `just check-pattachitra`.
      exclude: ["scripts/check-pattachitra.mjs"],
      reporter: ["text", "html", "json"],
    },
  },
});
