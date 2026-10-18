import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`);
}

const internalImport =
  "no-restricted-imports: 'IMPORT' import is restricted from being used by a pattern. Import from src/events, src/boundary or src/platform, not from their internal/ files.";

const assertion =
  "no-restricted-syntax: Build a CanonicalEvent with the functions in src/events, never with a type assertion.";

describe("isolated module lint gates", () => {
  it.each([
    ["src/routes/fixture.ts", "@/events/internal/x"],
    ["src/routes/fixture.ts", "@/events/internal"],
    ["src/routes/fixture.ts", "../events/internal/x"],
    ["src/routes/api/fixture.ts", "../../platform/internal/kv"],
    ["src/fixture.ts", "./boundary/internal/gdg"],
  ])("rejects %s importing %s", async (file, source) => {
    const code = `import { x } from "${source}";\n\nexport const y = x;\n`;
    expect(await lint(file, code)).toEqual([internalImport.replace("IMPORT", source)]);
    const reexport = `export { x } from "${source}";\n`;
    expect(await lint(file, reexport)).toEqual([internalImport.replace("IMPORT", source)]);
  });

  it.each([
    ["src/routes/fixture.ts", "@/events"],
    ["src/routes/fixture.ts", "./internal/x"],
    ["src/routes/fixture.ts", "@/lib/internals"],
  ])("allows %s importing %s", async (file, source) => {
    expect(await lint(file, `import { x } from "${source}";\n\nexport const y = x;\n`)).toEqual([]);
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
  ])("rejects %s outside src/events", async (expression) => {
    const code = [
      'import type { CanonicalEvent } from "@/events";',
      "",
      "declare const raw: unknown;",
      `export const event = ${expression};`,
      "",
    ].join("\n");
    expect(await lint("src/routes/fixture.ts", code)).toEqual([assertion]);
  });
});
