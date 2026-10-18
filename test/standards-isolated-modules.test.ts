import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import config from "../eslint.config.js";

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`);
}

const internalImport =
  "isolated/internal-imports: Import from src/events (or whichever module owns this internal/ folder), not from its internal/ files.";

const literalOnly =
  "isolated/internal-imports: Load modules by plain string paths with no wildcard directories so the internal/ fence can check them.";

const assertion =
  "isolated/canonical-event: Build a CanonicalEvent with the functions in src/events, never with a type assertion.";

const renamed =
  "isolated/canonical-event: Use CanonicalEvent under its own name so the type assertion ban can see it.";

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
      `import { x } from "${source}";\n\nexport const y = x;\n`,
      `export { x } from "${source}";\n`,
      `export * from "${source}";\n`,
      `export const load = () => import("${source}");\n`,
      `export type X = import("${source}").X;\n`,
    ])
      expect(await lint(file, code)).toEqual([internalImport]);
    for (const code of [
      `import x = require("${source}");\n\nexport const y = x;\n`,
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

  it.each([
    [
      "scripts/fixture.mjs",
      'import { x } from "../src/events/internal/x";\n\nexport const y = x;\n',
    ],
    ["scripts/fixture.js", 'export const load = () => import("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = require("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = module.require("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = require("../src/events/in" + "ternal/x");\n'],
    ["src/fixture.jsx", 'export { x } from "./events/internal/x";\n'],
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
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = x;\n`)).toEqual([
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
  ])("allows %s importing %s", async (file, source) => {
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = x;\n`)).toEqual([]);
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
        "no-restricted-syntax: Write src/events, src/boundary and src/platform in TypeScript so the strict typecheck and lint cover them.",
      ]);
    },
  );

  it("keeps the server-only import ban", async () => {
    expect(await lint("src/routes/fixture.ts", 'import "server-only";\n')).toEqual([
      expect.stringContaining("no-restricted-imports: 'server-only' import is restricted"),
    ]);
  });

  it.each([
    "raw as CanonicalEvent",
    "raw as unknown as CanonicalEvent",
    "<CanonicalEvent>raw",
    "raw as readonly CanonicalEvent[]",
    "raw as Partial<CanonicalEvent>",
    "raw as Events.CanonicalEvent",
    "raw as Readonly<Events.CanonicalEvent>",
    'raw as import("@/events").CanonicalEvent',
  ])("rejects %s outside src/events", async (expression) => {
    const code = [
      'import type { CanonicalEvent } from "@/events";',
      'import type * as Events from "@/events";',
      "",
      "declare const raw: unknown;",
      `export const event = ${expression};`,
      "",
    ].join("\n");
    expect(await lint("src/routes/fixture.ts", code)).toEqual([assertion]);
  });

  it.each([
    'import type { CanonicalEvent as Event } from "@/events";\n',
    'import type { "CanonicalEvent" as Event } from "@/events";\n',
    'export type { "CanonicalEvent" as Event } from "@/events";\n',
    'export type { CanonicalEvent as Event } from "@/events";\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = CanonicalEvent;\n',
    'export type Event = import("@/events").CanonicalEvent;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = Partial<CanonicalEvent>;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = readonly CanonicalEvent[];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = CanonicalEvent & { readonly extra: true };\n',
    'import type * as Events from "@/events";\n\ntype Event = Events.CanonicalEvent;\n\nexport type { Event };\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = { value: CanonicalEvent }["value"];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = ReturnType<() => CanonicalEvent>;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = [CanonicalEvent?];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event<T = CanonicalEvent> = T;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event<T extends CanonicalEvent> = T;\n',
    'import * as Events from "@/events";\n\nimport Event = Events.CanonicalEvent;\n\nexport type { Event };\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = [...CanonicalEvent[]];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport interface Event extends CanonicalEvent {\n  readonly extra: true;\n}\n',
  ])("rejects renaming CanonicalEvent: %s", async (code) => {
    expect(await lint("src/routes/fixture.ts", code)).toEqual([renamed]);
  });

  it("allows types that hold a CanonicalEvent", async () => {
    const code = [
      'import type { CanonicalEvent } from "@/events";',
      "",
      "export type Props = { readonly event: CanonicalEvent };",
      "export type Render = (event: CanonicalEvent) => string;",
      "export type EventField = keyof CanonicalEvent;",
      "export type State = { readonly event: CanonicalEvent } | null;",
      "export type Pair = readonly [{ readonly event: CanonicalEvent }, (event: CanonicalEvent) => void];",
      'export const unrelated = JSON.parse("{}") as { CanonicalEvent: string; CanonicalEvent2(): void };',
      'export type Title = CanonicalEvent["title"];',
      "",
    ].join("\n");
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });

  it("allows CanonicalEvent outside the asserted type", async () => {
    const code = [
      'import type { CanonicalEvent } from "@/events";',
      "",
      "declare function load<T>(): T;",
      "export const count = load<CanonicalEvent>() as unknown as number;",
      "",
    ].join("\n");
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });
});
