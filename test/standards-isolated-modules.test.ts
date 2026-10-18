import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`);
}

const internalImport =
  "no-restricted-syntax: Import from src/events, src/boundary or src/platform, not from their internal/ files.";

const assertion =
  "no-restricted-syntax: Build a CanonicalEvent with the functions in src/events, never with a type assertion.";

const renamed =
  "no-restricted-syntax: Use CanonicalEvent under its own name so the type assertion ban can see it.";

describe("isolated module lint gates", () => {
  it.each([
    ["src/routes/fixture.ts", "@/events/internal/x"],
    ["src/routes/fixture.ts", "@/events/internal"],
    ["src/routes/fixture.ts", "../events/internal/x"],
    ["src/routes/api/fixture.ts", "../../platform/internal/kv"],
    ["src/fixture.ts", "./boundary/internal/gdg"],
    ["src/routes/fixture.mts", "@/events/internal/x"],
    ["src/routes/fixture.cts", "@/events/internal/x"],
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
      expect(await lint(file, code)).toEqual([
        "@typescript-eslint/no-require-imports: A `require()` style import is forbidden.",
      ]);
  });

  it.each([
    "import(`@/events/internal/${name}`)",
    "import(`../events/${name}/internal/x`)",
    "import(`@/${name}/internal`)",
  ])("rejects the template-literal dynamic import %s", async (expression) => {
    const code = `export const load = (name: string) => ${expression};\n`;
    expect(await lint("src/routes/fixture.ts", code)).toEqual([internalImport]);
  });

  it("allows a module to load its own internal files with a template literal", async () => {
    const code = "export const load = (name: string) => import(`./internal/${name}`);\n";
    expect(await lint("src/events/fixture.ts", code)).not.toContain(internalImport);
  });

  it.each([
    ["src/routes/fixture.ts", "@/events"],
    ["src/routes/fixture.ts", "./internal/x"],
    ["src/routes/fixture.ts", "@/lib/internals"],
  ])("allows %s importing %s", async (file, source) => {
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = x;\n`)).toEqual([]);
    expect(await lint(file, `export const load = () => import("${source}");\n`)).toEqual([]);
  });

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
    'export type { CanonicalEvent as Event } from "@/events";\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = CanonicalEvent;\n',
    'export type Event = import("@/events").CanonicalEvent;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = Partial<CanonicalEvent>;\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Events = readonly CanonicalEvent[];\n',
    'import type { CanonicalEvent } from "@/events";\n\nexport type Event = CanonicalEvent & { readonly extra: true };\n',
    'import type * as Events from "@/events";\n\ntype Event = Events.CanonicalEvent;\n\nexport type { Event };\n',
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
