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
      reporter: ["text", "html", "json"],
    },
  },
});
