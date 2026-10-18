import { resolve } from "node:path";
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
  "isolated/owned-types: Build src/events values with the functions in src/events, never with a type assertion.";

const typeArgument =
  "isolated/owned-types: Let TypeScript infer src/events types instead of passing one as a type argument, which can skip their checks.";

const parsed =
  "isolated/owned-types: Parse untyped data with the functions in src/events instead of typing it as a src/events type.";

const relay =
  "isolated/owned-types: Import src/events types from src/events itself so the type assertion ban can see them.";

const never =
  "no-restricted-syntax: Never assert to never or name it as a type: it fits every type, including the src/events types that only their functions may build.";

const header = [
  'import type { CanonicalEvent, Dates, ExactDates, IsoDay, Text } from "@/events";',
  'import type * as Events from "@/events";',
  'import { join, save } from "@/events";',
  "",
  "declare const raw: unknown;",
  "declare const s: string;",
  "export const keep = [join, save, s];",
  "",
].join("\n");

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
      expect((await lint(file, code))?.filter((message) => message !== relay)).toEqual([
        internalImport,
      ]);
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

  it.each([
    [
      "scripts/fixture.mjs",
      'import { x } from "../src/events/internal/x";\n\nexport const y = [x];\n',
    ],
    ["scripts/fixture.js", 'export const load = () => import("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = require("../src/events/internal/x");\n'],
    ["scripts/fixture.cjs", 'module.exports = module.require("../src/events/internal/x");\n'],
    ["scripts/fixture.mjs", 'export { x } from "../src/events/%69nternal/x.ts";\n'],
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
    "raw as ReturnType<typeof join>",
    "raw as Parameters<typeof join>[0]",
    '{ kind: "exact", end: "2026-03-05" } as unknown as ExactDates',
    '"2026-02-30" as IsoDay',
    '"" as Text',
    "raw as Dates",
    'raw as import("../events/model").IsoDay',
    'raw as import("/src/events/model").IsoDay',
  ])("rejects %s outside src/events", async (expression) => {
    const code = `${header}export const value = ${expression};\n`;
    expect(await lint("src/routes/fixture.ts", code)).toEqual([assertion]);
  });

  it.each([
    'import type { IsoDay as Day } from "@/events";\n\nexport const day = "2026-02-30" as Day;\n',
    'import type { IsoDay } from "../events/model";\n\nexport const day = "2026-02-30" as IsoDay;\n',
    'import Events = require("@/events");\n\nexport const day = "2026-02-30" as Events.IsoDay;\n',
    `${header}type Day = IsoDay;\n\nexport const day = "2026-02-30" as Day;\n`,
    `${header}type Box = { value: CanonicalEvent };\n\nexport const event = raw as Box["value"];\n`,
    `${header}interface Holder {\n  readonly event: CanonicalEvent;\n}\n\nexport const holder = raw as Holder;\n`,
    `${header}declare const x: CanonicalEvent;\n\nexport const event = raw as typeof x & {};\n`,
    `${header}const merged = join;\n\nexport const event = raw as ReturnType<typeof merged>;\n`,
    `${header}export function first(events: readonly CanonicalEvent[]) {\n  return raw as typeof events;\n}\n`,
  ])("rejects an assertion to a src/events type through a local name: %s", async (code) => {
    expect((await lint("src/routes/fixture.ts", code))?.filter((m) => m !== never)).toEqual(
      expect.arrayContaining([assertion]),
    );
  });

  it.each([
    "declare function cast<T>(value: unknown): T;\n\nexport const event = cast<CanonicalEvent>(raw);\n",
    'declare const kv: { get<T>(key: string, type: "json"): Promise<T | null> };\n\nexport const event = kv.get<CanonicalEvent>("k", "json");\n',
    "export const days = new Map<string, IsoDay>();\n",
    "declare function cast<T>(value: unknown): T;\n\nexport const toDay = cast<Events.IsoDay>;\n",
  ])("rejects a src/events type as a type argument: %s", async (code) => {
    expect(await lint("src/routes/fixture.ts", `${header}${code}`)).toEqual([typeArgument]);
  });

  it.each([
    "export const event: CanonicalEvent = JSON.parse(s);\n",
    "export function load(): CanonicalEvent {\n  return JSON.parse(s);\n}\n",
    "export const load = (): CanonicalEvent => JSON.parse(s);\n",
    "export async function load(response: Response) {\n  const event: CanonicalEvent = await response.json();\n  return event;\n}\n",
    'declare const kv: { get(key: string, type: "json"): Promise<unknown> };\n\nexport async function load() {\n  const event: CanonicalEvent | null = await kv.get("k", "json");\n  return event;\n}\n',
    'declare const kv: { get(key: string, options: { type: "json" }): Promise<unknown> };\n\nexport async function load() {\n  const event: CanonicalEvent | null = await kv.get("k", { type: "json" });\n  return event;\n}\n',
    "export const saved = save(JSON.parse(s));\n",
    "export const event: CanonicalEvent = JSON.parse(s)!;\n",
    "export const events: CanonicalEvent[] = [JSON.parse(s)];\n",
    "export const events: CanonicalEvent[] = [...JSON.parse(s)];\n",
    "export const holder: { event: CanonicalEvent } = { event: JSON.parse(s) };\n",
    "export const event: CanonicalEvent | null = s ? JSON.parse(s) : null;\n",
    "export const event: CanonicalEvent | null = (s && JSON.parse(s)) || null;\n",
    "let event: CanonicalEvent | undefined;\n\nexport function load() {\n  event = JSON.parse(s);\n  return event;\n}\n",
  ])("rejects untyped data typed as a src/events type: %s", async (code) => {
    expect(await lint("src/routes/fixture.ts", `${header}${code}`)).toEqual([parsed]);
  });

  it.each([
    ["src/routes/fixture.ts", "export const event: CanonicalEvent = raw as never;\n"],
    ["src/routes/fixture.ts", "export const event: CanonicalEvent = <never>raw;\n"],
    ["src/routes/fixture.ts", "export const event = raw as never satisfies CanonicalEvent;\n"],
    ["scripts/fixture.ts", "export const event: CanonicalEvent = raw as never;\n"],
    [
      "src/routes/fixture.ts",
      "type Bottom = never;\n\nexport const event: CanonicalEvent = raw as Bottom;\n",
    ],
    [
      "src/routes/fixture.ts",
      "export const event: CanonicalEvent = raw as never & { id: string };\n",
    ],
  ])("rejects asserting to never in %s: %s", async (file, code) => {
    expect(await lint(file, `${header}${code}`)).toEqual([never]);
  });

  it.each([
    'export type { IsoDay } from "@/events";\n',
    'export { join } from "@/events";\n',
    'export * from "@/events";\n',
    'export * as Events from "@/events";\n',
    'import type { IsoDay } from "@/events";\n\nexport type { IsoDay };\n',
    'import type { IsoDay as Day } from "@/events";\n\nexport type { Day };\n',
    'import type { IsoDay } from "@/events";\n\nexport type Day = IsoDay;\n',
    'import type { IsoDay } from "@/events";\n\ntype Day = IsoDay;\n\nexport type { Day };\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = Partial<CanonicalEvent>;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = readonly CanonicalEvent[];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = CanonicalEvent & { readonly extra: true };\n',
    'export type Event = import("@/events").CanonicalEvent;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = { value: CanonicalEvent }["value"];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = ReturnType<() => CanonicalEvent>;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = [CanonicalEvent?];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event<T = CanonicalEvent> = T;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event<T extends CanonicalEvent> = T;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = [...CanonicalEvent[]];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport interface Event extends CanonicalEvent {\n  readonly extra: true;\n}\n',
    'import type { CanonicalEvent } from "@/events";\n\ndeclare const event: CanonicalEvent;\n\nexport type Event = typeof event;\n',
    'import { join } from "@/events";\n\nexport const make = join;\n',
    'import * as Events from "@/events";\n\nexport const make = Events.join;\n',
    'import { join } from "@/events";\n\nexport default join;\n',
    'import { join } from "@/events";\n\nconst make = join;\n\nexport { make };\n',
  ])("rejects passing a src/events type on under another module: %s", async (code) => {
    expect(await lint("src/lib/fixture.ts", code)).toEqual([relay]);
  });

  it("allows types and values that hold or use src/events types", async () => {
    const code = [
      header,
      "export type Props = { readonly event: CanonicalEvent };",
      "export type Render = (event: CanonicalEvent) => string;",
      "export type EventField = keyof CanonicalEvent;",
      "export type State = { readonly event: CanonicalEvent } | null;",
      "export type Pair = readonly [{ readonly event: CanonicalEvent }, (event: CanonicalEvent) => void];",
      'export type Title = CanonicalEvent["title"];',
      'export const unrelated = JSON.parse("{}") as { CanonicalEvent: string; IsoDay(): void };',
      "export const count = raw as number;",
      "export const names = new Set<string>();",
      "export const loaded: unknown = JSON.parse(s);",
      "export const day: IsoDay | null = null;",
      "export const days: Map<string, IsoDay> = new Map();",
      "declare const cache: { get(key: string): CanonicalEvent | undefined };",
      'export const cached: CanonicalEvent | undefined = cache.get("json");',
      "declare const json: string;",
      "declare const store: { get(key: string, type: string): IsoDay };",
      'export const stored: IsoDay = store.get("k", json);',
      "export function render(event: CanonicalEvent) {",
      "  return join(event, event);",
      "}",
      "",
    ].join("\n");
    expect(await lint("src/routes/fixture.ts", code)).toEqual([]);
  });

  it("allows src/events tests to name its types anywhere", async () => {
    const code = [
      'import type { IsoDay } from "@/events/model";',
      "",
      "declare function cast<T>(value: unknown): T;",
      'export const day = cast<IsoDay>("2026-02-30");',
      'export const days = new Set<IsoDay>(["2026-02-30" as IsoDay]);',
      'export type { IsoDay } from "@/events/model";',
      "",
    ].join("\n");
    expect(await lint("test/events/fixture.test.ts", code)).toEqual([]);
  });

  it("allows asserting to never in tests", async () => {
    expect(await lint("test/fixture.test.ts", "export const value = null as never;\n")).toEqual([]);
  });

  it("resolves the internal fence from the repo root whatever directory ESLint runs in", async () => {
    const root = resolve(import.meta.dirname, "..");
    const nested = new ESLint({
      cwd: resolve(root, "src"),
      overrideConfigFile: true,
      overrideConfig: config,
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
