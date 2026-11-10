import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: join(import.meta.dirname, "..") });

describe("eslint ignores follow .gitignore", () => {
  it.each([
    "coverage/lcov-report/prettify.js",
    "coverage/prettify.js",
    "playwright-report/trace/sw.bundle.js",
    "test-results/resource-chromium/trace.js",
    "scratch/probe.js",
    ".wrangler/tmp/bundle.js",
    ".lavish/mockup.js",
    "dist/server/index.js",
  ])("skips generated %s", async (file) => {
    expect(await eslint.isPathIgnored(file)).toBe(true);
  });

  it.each(["src/server.ts", "scripts/standards.ts", "test/e2e/serve.mjs", "eslint.config.js"])(
    "still lints %s",
    async (file) => {
      expect(await eslint.isPathIgnored(file)).toBe(false);
    },
  );
});
