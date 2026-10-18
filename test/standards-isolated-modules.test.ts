import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import tseslint from "typescript-eslint";
import config from "../eslint.config.js";

const fence = [
  ...config,
  {
    files: ["src/**/*.{ts,tsx,mts,cts}"],
    ...tseslint.configs.disableTypeChecked,
    rules: { ...tseslint.configs.disableTypeChecked.rules, "isolated/owned-types": "off" as const },
  },
];

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: fence });

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`);
}

const internalImport =
  "isolated/internal-imports: Import from src/events (or whichever module owns this internal/ folder), not from its internal/ files.";

const literalOnly =
  "isolated/internal-imports: Load modules by plain string paths with no wildcard directories so the internal/ fence can check them.";

describe("isolated module lint gates", () => {
  it.each([
    ["src/routes/fixture.ts", "@/events/internal/x"],
    ["src/routes/fixture.ts", "@/events/internal"],
    ["src/routes/fixture.ts", "../events/internal/x"],
    ["src/routes/api/fixture.ts", "../../platform/internal/kv"],
    ["src/fixture.ts", "./boundary/internal/gdg"],
    ["src/routes/fixture.mts", "@/events/internal/x"],
    ["src/routes/fixture.cts", "@/events/internal/x"],
    ["src/routes/fixture.ts", "../events//internal/x"],
    ["src/routes/fixture.ts", "../events/./internal/x"],
    ["src/routes/fixture.ts", "@/events/internal?raw"],
    ["src/routes/fixture.ts", "@/events/internal#x"],
    ["src/routes/fixture.ts", "/src/events/internal/x"],
  ])("rejects %s importing %s", async (file, source) => {
    for (const code of [
      `import { x } from "${source}";\n\nexport const y = [x];\n`,
      `export { x } from "${source}";\n`,
      `export * from "${source}";\n`,
      `export const load = () => import("${source}");\n`,
      `export type X = import("${source}").X;\n`,
    ])
      expect(await lint(file, code)).toEqual([internalImport]);
    for (const code of [
      `import x = require("${source}");\n\nexport const y = [x];\n`,
      `export const load = () => require("${source}");\n`,
    ])
      expect((await lint(file, code))?.sort()).toEqual([
        "@typescript-eslint/no-require-imports: A `require()` style import is forbidden.",
        internalImport,
      ]);
  });

  it.each([
    "import(`@/events/internal/${name}`)",
    "import(`../events/${name}/internal/x`)",
    "import(`../events/int\\u0065rnal/x`)",
    "import(`./internal/x`)",
    'import("../events/" + "internal/x")',
    'import("../events/in" + "ternal/x")',
    "import(name)",
    "import.meta.glob(name)",
    'import.meta.glob("@/events/i[n]ternal/*.ts")',
    'import.meta.glob("@/events/{internal,public}/*.ts")',
    'import.meta.glob(["@/events/*.ts", name])',
    'import.meta.glob("@/events/**/*.ts")',
    'import.meta.glob("@/*/internal.ts")',
    'import.meta.glob("@/events/**")',
    'import.meta.glob("./*.ts", { base: "../events/internal" })',
    'import.meta.glob("@/events/*.ts", { [name]: true })',
    'import.meta.glob("@/events/*.ts", { ...{ base: name } })',
    'import.meta.glob("@/events/*.ts", name)',
  ])("rejects the computed dynamic import %s", async (expression) => {
    const code = `export const load = (name: string) => ${expression};\n`;
    expect(await lint("src/routes/fixture.ts", code)).toEqual([literalOnly]);
  });

  it.each([
    'vi.importActual("@/events/internal/x")',
    'vi.importMock("../events/internal/x")',
    'vi.mock("@/events/internal/x")',
    'vi.doMock("@/events/internal/x", () => ({}))',
    'vi.unmock("@/events/internal/x")',
    'vi.doUnmock("@/events/internal/x")',
  ])("rejects the Vitest loader %s", async (expression) => {
    const code = `import { vi } from "vitest";\n\nexport const load = () => ${expression};\n`;
    expect(await lint("src/routes/fixture.ts", code)).toEqual([internalImport]);
  });

  it("rejects a Vitest loader with a computed path", async () => {
    const code =
      'import { vi } from "vitest";\n\nexport const load = (name: string) => vi.importActual(name);\n';
    expect(await lint("src/routes/fixture.ts", code)).toEqual([literalOnly]);
  });

  it("allows a Vitest mock of an import() of a public file", async () => {
    const code = 'import { vi } from "vitest";\n\nvi.mock(import("@/events/model"));\n';
    expect(await lint("test/routes/fixture.test.ts", code)).toEqual([]);
  });

  it.each([
    'import.meta.glob("@/events/internal/*.ts")',
    'import.meta.glob(["@/events/*.ts", "../platform/internal/*.ts"])',
  ])("rejects the glob import %s", async (expression) => {
    expect(await lint("src/routes/fixture.ts", `export const load = ${expression};\n`)).toEqual([
      internalImport,
    ]);
  });

  it("allows a glob over a module's public files", async () => {
    const code =
      'export const load = import.meta.glob(["@/events/*.ts", "./internal/*.ts"], { eager: true });\n';
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });

  it("allows a glob that excludes a module's internal files", async () => {
    const code =
      'export const load = import.meta.glob(["@/events/*.ts", "!@/events/internal/*.ts"]);\n';
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });

  it.each([
    [
      "scripts/fixture.mjs",
      'import { x } from "../src/events/internal/x";\n\nexport const y = [x];\n',
    ],
    ["scripts/fixture.js", 'export const load = () => import("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = require("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = module.require("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = module["require"]("../src/events/internal/x");\n'],
    ["scripts/fixture.mjs", 'export { x } from "../src/events/%69nternal/x.ts";\n'],
    ["scripts/fixture.cjs", 'module.exports = require("../src/events/in" + "ternal/x");\n'],
    ["src/fixture.jsx", 'export { x } from "./events/internal/x";\n'],
    ["scripts/fixture.cjs", 'module.exports = require("..\\\\src\\\\events\\\\internal\\\\x");\n'],
  ])("rejects the JavaScript consumer %s", async (file, code) => {
    expect(await lint(file, code)).toEqual(
      expect.arrayContaining([expect.stringMatching(/internal\/ (files|fence)/)]),
    );
  });

  it.each([
    ["src/routes/fixture.ts", "../events/parsers/../internal/x"],
    ["src/lib/parsers/fixture.ts", "../../boundary/internal/x"],
    ["src/routes/fixture.ts", "@/lib/internal/x"],
  ])("rejects %s importing %s once the path is resolved", async (file, source) => {
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = [x];\n`)).toEqual([
      internalImport,
    ]);
  });

  it.each([
    ["src/routes/fixture.ts", "@/events"],
    ["src/lib/parsers/fixture.ts", "../internal/normalize"],
    ["src/lib/parsers/fixture.ts", "@/lib/internal/normalize"],
    ["src/routes/fixture.ts", "../internal/x"],
    ["src/routes/fixture.ts", "./internal/x"],
    ["src/routes/fixture.ts", "@/lib/internals"],
    ["src/routes/fixture.ts", "@/lib/100%"],
  ])("allows %s importing %s", async (file, source) => {
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = [x];\n`)).toEqual(
      [],
    );
    expect(await lint(file, `export const load = () => import("${source}");\n`)).toEqual([]);
  });

  it("allows new.target.glob, which is not a Vite glob", async () => {
    const code =
      "export class Loader {\n  constructor(name: string) {\n    new.target.glob(name);\n  }\n}\n";
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });

  it.each(["src/events/fixture.js", "src/boundary/fixture.mjs", "src/platform/fixture.cjs"])(
    "rejects JavaScript in the strict module %s",
    async (file) => {
      expect(await lint(file, "globalThis.x = 1;\n")).toEqual([
        "no-restricted-syntax: Use TypeScript so the strict checks cover this file.",
      ]);
    },
  );

  it("keeps the server-only import ban", async () => {
    expect(await lint("src/routes/fixture.ts", 'import "server-only";\n')).toEqual([
      expect.stringContaining("no-restricted-imports: 'server-only' import is restricted"),
    ]);
  });

  it("flags a forged src/events value in src .ts, .mts and .cts files, but not in src/events", async () => {
    const root = mkdtempSync(join(tmpdir(), "isolated-guard-"));
    const write = (file: string, code: string) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), code);
    };
    const forge = `export const day = "2026-02-30" as Day;\n`;
    write(
      "src/events/model.ts",
      'declare const brand: unique symbol;\nexport type Day = string & { readonly [brand]: "Day" };\n',
    );
    write("src/events/own.ts", `import type { Day } from "./model";\n${forge}`);
    const consumers = ["src/routes/forge.ts", "src/routes/forge.mts", "src/routes/forge.cts"];
    for (const file of consumers)
      write(file, `import type { Day } from "../events/model";\n${forge}`);
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          strict: true,
          module: "ESNext",
          moduleResolution: "Bundler",
          noEmit: true,
        },
        include: ["src/**/*"],
      }),
    );
    try {
      const real = new ESLint({
        cwd: root,
        overrideConfigFile: true,
        overrideConfig: [
          ...config,
          {
            files: ["src/**/*.{ts,tsx,mts,cts}"],
            languageOptions: {
              parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root },
            },
            rules: {
              "isolated/owned-types": [
                "error",
                {
                  modules: [relative(resolve(import.meta.dirname, ".."), join(root, "src/events"))],
                },
              ],
            },
          },
        ],
      });
      const results = await real.lintFiles(["src/events/own.ts", ...consumers]);
      expect(
        results.map(
          (result) =>
            result.messages.filter((message) => message.ruleId === "isolated/owned-types").length,
        ),
      ).toEqual([0, 1, 1, 1]);
    } finally {
      rmSync(root, { recursive: true });
    }
  }, 60_000);

  it("refuses to run owned-types without type information", async () => {
    const untyped = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        ...config,
        {
          files: ["src/**/*.ts"],
          languageOptions: {
            parser: {
              parseForESLint: (code: string) => ({
                ...tseslint.parser.parseForESLint(code),
                services: {},
              }),
            },
          },
        },
      ],
    });
    await expect(
      untyped.lintText("export const x = 1;\n", { filePath: "src/routes/fixture.ts" }),
    ).rejects.toThrow(/needs type information/);
  });

  it("resolves the internal fence from the repo root whatever directory ESLint runs in", async () => {
    const root = resolve(import.meta.dirname, "..");
    const nested = new ESLint({
      cwd: resolve(root, "src"),
      overrideConfigFile: true,
      overrideConfig: fence,
    });
    const code = 'import { x } from "@/events/internal/x";\n\nexport const y = [x];\n';
    const lintFrom = async (file: string) =>
      (await nested.lintText(code, { filePath: resolve(root, file) }))[0]?.messages.map(
        ({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`,
      );
    expect(await lintFrom("src/events/own.ts")).toEqual([]);
    expect(await lintFrom("src/routes/fixture.ts")).toEqual([internalImport]);
  });
});
