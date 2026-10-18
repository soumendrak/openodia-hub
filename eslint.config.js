import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import isolated from "./scripts/standards/eslint-isolated-modules.js";

export default defineConfig(
  // `.lavish` is the gitignored design scratch directory — mockups, not source.
  { ignores: ["dist", ".output", ".vinxi", ".lavish"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      isolated,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "isolated/internal-imports": "error",
      "isolated/canonical-event": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    plugins: { isolated },
    rules: { "isolated/internal-imports": "error" },
  },
  {
    files: ["src/{events,boundary,platform}/**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message:
            "Write src/events, src/boundary and src/platform in TypeScript so the strict typecheck and lint cover them.",
        },
      ],
    },
  },
  {
    files: ["src/{events,boundary,platform}/**/*.{ts,tsx,mts,cts}"],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { project: "./tsconfig.strict.json", tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    },
  },
  eslintPluginPrettier,
);
