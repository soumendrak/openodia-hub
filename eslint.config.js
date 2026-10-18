import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const slashes = (pattern) => pattern.replaceAll("/", "\\x2F");
const internalPath = slashes("^(?:@/+|\\.\\./+|\\./+[^/]+/+)(?:[^/]*/+)*?internal(?:/|$)");
const internalSegment = slashes("^(?!\\./+internal(?:/|$)).*(?:^|/)internal(?:/|$)");
const loader = ":matches(ImportExpression, CallExpression[callee.name='require'])";

const internalFence = {
  selector: [
    `:matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, TSImportType, TSExternalModuleReference) > Literal[value=/${internalPath}/]`,
    `${loader} Literal[value=/${internalSegment}/]`,
    `${loader} TemplateElement[value.cooked=/${internalSegment}/]`,
  ].join(", "),
  message: "Import from src/events, src/boundary or src/platform, not from their internal/ files.",
};

export default tseslint.config(
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
      "no-restricted-syntax": [
        "error",
        internalFence,
        {
          selector:
            ":matches(TSAsExpression, TSTypeAssertion) > .typeAnnotation Identifier[name='CanonicalEvent']",
          message:
            "Build a CanonicalEvent with the functions in src/events, never with a type assertion.",
        },
        {
          selector: [
            "ImportSpecifier[imported.name='CanonicalEvent'][local.name!='CanonicalEvent']",
            "ExportSpecifier[local.name='CanonicalEvent'][exported.name!='CanonicalEvent']",
            "TSTypeAliasDeclaration > .typeAnnotation Identifier[name='CanonicalEvent']:not(TSTypeLiteral Identifier, TSFunctionType Identifier, TSTypeOperator[operator='keyof'] Identifier, TSIndexedAccessType Identifier)",
            "TSInterfaceHeritage Identifier[name='CanonicalEvent']",
          ].join(", "),
          message: "Use CanonicalEvent under its own name so the type assertion ban can see it.",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: { "no-restricted-syntax": ["error", internalFence] },
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
