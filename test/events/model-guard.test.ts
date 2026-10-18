import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../../eslint.config.js";

const MODULE = "src/events";
const FIXTURES = `src/lib/guard-fixture-${String(process.pid)}`;
const UNBRANDED = ["Attendance", "Field", "Result"];

const files = readdirSync(MODULE, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => `${MODULE}/${file}`);

const exports = files.flatMap((file) => {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
  const specifier = `@/${file.slice("src/".length).replace(/\.tsx?$/, "")}`;
  return source.statements.flatMap((statement) => {
    const exported =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) return [];
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap(({ name }) =>
          ts.isIdentifier(name) ? [name.text] : [],
        )
      : "name" in statement && statement.name && ts.isIdentifier(statement.name)
        ? [statement.name.text]
        : [];
    const type =
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement);
    const value = ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement);
    return names.map((name) => ({ name, specifier, type, value }));
  });
});

const probes = new Map<string, string>([
  ...exports
    .filter(({ type, name }) => type && !UNBRANDED.includes(name))
    .map(({ name, specifier }): [string, string] => [
      `type-${name}`,
      `import type { ${name} } from "${specifier}";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ${name};\n`,
    ]),
  ...exports
    .filter(({ value }) => value)
    .map(({ name, specifier }): [string, string] => [
      `value-${name}`,
      `import { ${name} } from "${specifier}";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ReturnType<typeof ${name}>;\n`,
    ]),
  [
    "merge-exact-dates",
    'import { dates, isoDay } from "@/events/model";\n\nconst day = isoDay("2026-04-10");\nconst range = day.ok ? dates({ start: day.value, end: day.value, previous: null }) : undefined;\n\nexport const forged = range?.ok && Object.assign({}, range.value, { start: "2026-03-05" });\n',
  ],
]);

let messages: Map<string, string[]>;

beforeAll(async () => {
  mkdirSync(FIXTURES, { recursive: true });
  for (const [name, code] of probes) writeFileSync(join(FIXTURES, `${name}.ts`), code);
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
  const results = await eslint.lintFiles([FIXTURES, ...files, "test/events"]);
  messages = new Map(
    results.map(({ filePath, messages: found }) => [
      filePath,
      found.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`),
    ]),
  );
}, 60_000);

afterAll(() => rmSync(FIXTURES, { recursive: true, force: true }));

const lintOf = (file: string) => messages.get(join(process.cwd(), file)) ?? [];

describe("the src/events lint guard", () => {
  it("reads every exported type, class and function of every src/events file", () => {
    expect(exports.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["CanonicalEvent", "Dates", "ExactDates", "IsoDay", "Text", "join"]),
    );
  });

  it.each([...probes.keys()])("rejects building %s outside src/events", (name) => {
    const found = lintOf(`${FIXTURES}/${name}.ts`).filter((m) => m.startsWith("isolated/"));
    expect(found).toEqual([expect.stringMatching(/^isolated\/owned-types: /)]);
  });

  it("keeps src/events and its tests lint-clean", () => {
    const owned = [...messages].filter(([file]) => !file.includes("guard-fixture-"));
    expect(owned.flatMap(([, found]) => found)).toEqual([]);
  });
});
