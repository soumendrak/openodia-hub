import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../eslint.config.js";

const MODEL = `
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
export type IsoDay = Brand<string, "IsoDay">;
export type Text = Brand<string, "Text">;
export const isoDay = (s: string) => (/^\\d{4}-\\d{2}-\\d{2}$/.test(s) ? (s as IsoDay) : undefined);
export const text = (s: string) => (s ? (s as Text) : undefined);
export class ExactDates {
  readonly #sealed = true;
  private constructor(readonly start: IsoDay, readonly end: IsoDay) {}
  static of(start: IsoDay, end: IsoDay) {
    return start <= end ? new ExactDates(start, end) : undefined;
  }
  get sealed() {
    return this.#sealed;
  }
}
export class Sealed {
  private sealed = true;
  get open() {
    return !this.sealed;
  }
}
export type Dates = ExactDates | { readonly kind: "approximate"; readonly month: number };
export type CanonicalEvent = { readonly title: Text; readonly dates: Dates; readonly id: string };
export const join = (title: Text, dates: Dates): CanonicalEvent => ({ title, dates, id: "x" });
export const save = (event: CanonicalEvent) => event.id;
`;

const HEADER = `import type { CanonicalEvent, Dates, IsoDay, Text } from "../events";
import { ExactDates, isoDay, join, save, text } from "../events";
declare const raw: unknown;
declare const s: string;
export const event: CanonicalEvent = join(text("t")!, { kind: "approximate", month: 4 });
export const keep = [isoDay, join, save, text, ExactDates, event, s];
`;

const flagged: Record<string, string> = {
  P01: "export const e: CanonicalEvent = raw as never;",
  P02: "declare function cast<T>(value: unknown): T;\nexport const e = cast<CanonicalEvent>(raw);",
  P03: 'declare const kv: { get<T>(key: string, type: "json"): Promise<T | null> };\nexport const e = kv.get<CanonicalEvent>("k", "json");',
  P04: "export const e: CanonicalEvent = JSON.parse(s);",
  P05: "export const e = raw as ReturnType<typeof join>;",
  P06: "export const e = raw as Parameters<typeof join>[0];",
  P07: "declare const x: CanonicalEvent;\nexport const e = raw as typeof x & {};",
  P08: 'type Box = { value: CanonicalEvent };\nexport const e = raw as Box["value"];',
  P09: "export const e = raw as never satisfies CanonicalEvent;",
  P10: 'export const d = { start: "2026-04-10", end: "2026-03-05" } as unknown as ExactDates;',
  P11: 'export const d = "2026-02-30" as IsoDay;',
  P12: 'export const t = "" as Text;',
  P13: "export const d = raw as Dates;",
  P14: 'import type { IsoDay as Day } from "../events";\nexport const d = "2026-02-30" as Day;',
  P15: 'import type { IsoDay as Day } from "../events/model";\nexport const d = "2026-02-30" as Day;',
  P16: 'import type * as Events from "../events";\nexport const d = "2026-02-30" as Events.IsoDay;',
  P17: 'export const d = "2026-02-30" as import("../events").IsoDay;',
  P18: "export function load(json: string): CanonicalEvent {\n  return JSON.parse(json);\n}",
  P19: "export async function load(response: Response) {\n  const e: CanonicalEvent = await response.json();\n  return e;\n}",
  P22: "export const e: CanonicalEvent = raw as any;",
  P23: "export const e: CanonicalEvent = raw as never & { id: string };",
  P24: "type Bottom = never;\nexport const e: CanonicalEvent = raw as Bottom;",
  P25: "export const es: CanonicalEvent[] = [JSON.parse(s)];",
  P29: "export const { e }: { e: CanonicalEvent } = JSON.parse(s);",
  P30: "export const e = JSON.parse(s) satisfies CanonicalEvent;",
  P31: "export function isEvent(value: unknown): value is CanonicalEvent {\n  return value !== null;\n}",
  P33: "export class Store {\n  e: CanonicalEvent = JSON.parse(s);\n}",
  P35: "export function handle(e: CanonicalEvent = JSON.parse(s)) {\n  return e;\n}",
  P39: "declare class Fake implements CanonicalEvent {\n  readonly title: Text;\n  readonly dates: Dates;\n  readonly id: string;\n}\nexport const e = new Fake();",
  P40: "export const e: CanonicalEvent = JSON.parse(s).event;",
  G01: "export function* load(): Generator<CanonicalEvent> {\n  yield JSON.parse(s);\n}",
  G02: "export function load() {\n  let e: CanonicalEvent;\n  const out: CanonicalEvent[] = [];\n  for (e of JSON.parse(s)) out.push(e);\n  return out;\n}",
  G03: "const parse = JSON.parse;\nexport const e: CanonicalEvent = parse(s);",
  R01: "declare global {\n  type EventAlias = CanonicalEvent;\n}\nexport const e = raw as EventAlias;",
  R02: "type Bottom = never | never;\nexport const e: CanonicalEvent = raw as Bottom;",
  R03: "export const e: CanonicalEvent = (raw as { d: never }).d;",
  R04: "export const e: CanonicalEvent = (raw as never[])[0]!;",
  R05: "export const m: Record<string, CanonicalEvent> = raw as Record<string, never>;",
  R06: "export const e: CanonicalEvent = (raw as Record<string, never>).k;",
  R07: "export const make: () => CanonicalEvent = raw as () => never;",
  R08: "export const e: CanonicalEvent = (raw as () => never)();",
  R09: "function forge(x: unknown): ExactDates;\nfunction forge(x: unknown): unknown {\n  return x;\n}\nexport const d = forge(raw);",
  R10: "function id<T>(x: unknown): T {\n  return x as T;\n}\nexport const d: ExactDates = id(raw);",
  R11: "function make<T = Dates>(x: unknown) {\n  return x as T;\n}\nexport const d = make(raw);",
  R12: 'declare function cachedJson<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T>;\nexport const e = cachedJson<CanonicalEvent>("k", 1, async () => JSON.parse(s));',
  R13: 'const memo = new Map<string, unknown>();\nasync function cachedJson<T>(key: string, load: () => Promise<T>): Promise<T> {\n  return (memo.get(key) as T | undefined) ?? load();\n}\nexport const e = cachedJson("k", async () => event);',
  R14: "export const d = Object.assign({}, ExactDates.of(isoDay(s)!, isoDay(s)!)!, { start: isoDay(s)! });",
  R15: "export const d: ExactDates = Object.create(ExactDates.prototype);",
  R16: "declare const e: CanonicalEvent;\nexport const out = e;",
  R17: "export class Store {\n  e!: CanonicalEvent;\n}",
  R18: "export declare function mint(): CanonicalEvent;",
  R19: "export const e = structuredClone(raw) as CanonicalEvent;",
  R20: "export const e: CanonicalEvent = { title: s, dates: raw, id: s } as any;",
  R21: "export const e: CanonicalEvent = (raw as { [key: string]: never }).k;",
  R22: 'function readStore<T>(key: string): T | undefined {\n  return key ? JSON.parse(key) : undefined;\n}\nasync function cachedJson<T>(key: string, load: () => Promise<T>) {\n  return readStore<T>(key) ?? (await load());\n}\nexport const e = cachedJson("k", async () => event);',
  R23: "const pick = <T,>(xs: readonly T[]) => xs[0];\nexport const e = pick([event]);",
  R24: "export const e = Object.assign({ ...event }, { title: s });",
  R25: "declare const Factory: new () => ExactDates;\nexport const d = new Factory();",
  R26: "export const Factory = raw as new () => ExactDates;",
  R27: 'import type { Sealed } from "../events";\nexport const x = raw as Sealed;',
  R28: 'import { make } from "fake-lib";\nexport const e = make<CanonicalEvent>();',
  R29: 'import { seeded } from "fake-lib";\nexport const e = seeded<CanonicalEvent>();',
  R30: 'import { tag } from "fake-lib";\nexport const e = tag<CanonicalEvent>`x`;',
  R31: "Object.assign(event, JSON.parse(s));",
  R32: 'import { is } from "fake-lib";\nexport const out = is<CanonicalEvent>(raw) ? save(raw) : null;',
  R33: 'import { assertIs } from "fake-lib";\nassertIs<CanonicalEvent>(raw);\nexport const out = save(raw);',
  R34: "declare const key: unique symbol;\nexport class Store {\n  [key]!: CanonicalEvent;\n}",
  R35: `type Many = ${Array.from({ length: 2600 }, (_, i) => `{ a${i}: ${i} }`).join(" | ")} | { last: CanonicalEvent };\nexport const e = raw as Many;`,
  C01: "export const load: () => CanonicalEvent = () => JSON.parse(s);",
  C02: "export class Store {\n  e: CanonicalEvent;\n  constructor() {\n    this.e = JSON.parse(s);\n  }\n}",
  C03: 'export async function load() {\n  const Events = await import("../events");\n  return raw as ReturnType<typeof Events.join>;\n}',
  C04: "export async function load(response?: Response) {\n  const e: CanonicalEvent | undefined = await response?.json();\n  return e;\n}",
  C06: "function parse(x: string): CanonicalEvent;\nfunction parse(x: unknown) {\n  return x;\n}\nexport const e = parse(s);",
};

const clean: Record<string, string> = {
  L01: 'const d = isoDay("2026-04-10");\nconst t = text("x");\nexport const e = d && t && join(t, ExactDates.of(d, d) ?? { kind: "approximate", month: 4 });',
  L02: "export const ids = new Map<string, IsoDay>();\nexport const none = [] as unknown[];",
  L03: "function first(es: readonly CanonicalEvent[]): CanonicalEvent | undefined {\n  return es[0];\n}\nexport const e = first([event]);",
  L04: 'function fail(message: string): never {\n  throw new Error(message);\n}\nexport const d: IsoDay = isoDay(s) ?? fail("bad day");',
  L05: "function persist(e: CanonicalEvent, extra: unknown) {\n  return [e, extra];\n}\nexport const out = persist(event, JSON.parse(s));",
  L07: 'async function get(): Promise<CanonicalEvent> {\n  return join(text("x")!, { kind: "approximate", month: 4 });\n}\nexport const e = await get();',
  L08: "export const titles = [event].map((e) => e.title);",
  L09: "class Holder {\n  constructor(readonly e: CanonicalEvent) {}\n}\nclass Store {\n  items: CanonicalEvent[] = [];\n}\nexport const out = [new Holder(event), new Store()];",
  L10: "export const frozen = Object.freeze(event);\nexport const copy = { ...event, title: text(s)! };",
  L11: 'declare function cachedJson<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T>;\nexport const raws = cachedJson<unknown>("k", 1, async () => JSON.parse(s));',
  L12: "export const parsed: unknown = JSON.parse(s);\nexport const label: string = event.title;",
  L14: "export function f() {\n  type Text = { value: string };\n  return raw as Text;\n}",
  L15: "export const list = Promise.resolve<IsoDay[]>([]);\nexport const day = Object.freeze(isoDay(s));",
  L16: "export function read(cache: { json(): CanonicalEvent }) {\n  const e: CanonicalEvent = cache.json();\n  return e;\n}",
  L17: 'import { box } from "fake-lib";\nexport const days = box<IsoDay>();',
  L18: 'export const id = raw as Pick<CanonicalEvent, "id">;',
  L19: "console.log(event, JSON.parse(s));",
  L13: "export type Label = Text;\nexport interface Wider extends CanonicalEvent {\n  readonly extra: true;\n}\nexport const relay = join;",
};

const isolated = config.find((block) => block.plugins?.["isolated"])?.plugins?.["isolated"];

let root: string;
let messages: Map<string, string[]>;

beforeAll(async () => {
  if (!isolated) throw new Error("eslint.config.js no longer registers the isolated plugin");
  root = mkdtempSync(join(tmpdir(), "owned-types-"));
  const write = (file: string, code: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), code);
  };
  write("events/model.ts", MODEL);
  write("node_modules/fake-lib/package.json", '{"name":"fake-lib","types":"index.d.ts"}');
  write(
    "node_modules/fake-lib/index.d.ts",
    [
      "export declare function make<T>(): T;",
      "export declare function box<T>(items?: readonly T[]): T[];",
      "export declare function seeded<T>(seed?: T): T;",
      "export declare function tag<T>(strings: TemplateStringsArray): T;",
      "export declare function is<T>(value: unknown): value is T;",
      "export declare function assertIs<T>(value: unknown): asserts value is T;",
    ].join("\n"),
  );
  write("events/index.ts", 'export * from "./model";\n');
  write(
    "events/own.ts",
    'import type { IsoDay } from "./model";\nexport const d = "x" as IsoDay;\n',
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM"],
        noEmit: true,
        jsx: "preserve",
        skipLibCheck: true,
      },
      include: ["**/*.ts", "**/*.tsx"],
    }),
  );
  for (const [name, code] of Object.entries({ ...flagged, ...clean }))
    write(`probes/${name}.ts`, `${HEADER}${code}\n`);
  write(
    "probes/J01.tsx",
    `${HEADER}function Card(props: { e: CanonicalEvent }) {\n  return <p>{props.e.id}</p>;\n}\nexport const card = <Card e={JSON.parse(s)} />;\n`,
  );
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root },
        },
        plugins: { isolated },
        rules: {
          "isolated/owned-types": [
            "error",
            { modules: [relative(join(import.meta.dirname, ".."), join(root, "events"))] },
          ],
        },
      },
    ],
  });
  const results = await eslint.lintFiles(["probes", "events"]);
  messages = new Map(
    results.map((result) => [
      relative(root, result.filePath).replace(/\.tsx?$/, ""),
      result.messages.map(
        ({ ruleId, message, line }) => `${line} ${ruleId ?? "fatal"}: ${message}`,
      ),
    ]),
  );
}, 60_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("isolated/owned-types", () => {
  it.each([...Object.keys(flagged), "J01"])("flags %s", (name) => {
    const found = messages.get(`probes/${name}`) ?? [];
    expect(found.length).toBeGreaterThan(0);
    for (const message of found) expect(message).toMatch(/^(?:[7-9]|\d\d) isolated\/owned-types: /);
  });

  it.each(Object.keys(clean))("passes %s", (name) => {
    expect(messages.get(`probes/${name}`)).toEqual([]);
  });

  it("lets the guarded module build its own values", () => {
    expect(messages.get("events/own")).toEqual([]);
    expect(messages.get("events/model")).toEqual([]);
  });
});
