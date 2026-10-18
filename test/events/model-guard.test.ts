import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import tseslint from "typescript-eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../../eslint.config.js";

const MODULE = "src/events";
const UNBRANDED = ["Result"];

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
    const generics = "typeParameters" in statement ? (statement.typeParameters?.length ?? 0) : 0;
    const args = generics
      ? `<${Array.from({ length: generics }, () => "unknown").join(", ")}>`
      : "";
    return names.map((name) => ({ name, specifier, type, value, args }));
  });
});

const probes = new Map<string, string>([
  ...exports
    .filter(({ type, name }) => type && !UNBRANDED.includes(name))
    .map(({ name, specifier, args }): [string, string] => [
      `type-${name}`,
      `import type { ${name} } from "${specifier}";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ${name}${args};\n`,
    ]),
  ...exports
    .filter(({ value }) => value)
    .map(({ name, specifier }): [string, string] => [
      `value-${name}`,
      `import { ${name} } from "${specifier}";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ReturnType<typeof ${name}>;\n`,
    ]),
  [
    "merge-exact-dates",
    'import { ExactDates, isoDay } from "@/events/model";\n\nconst day = isoDay("2026-04-10");\nconst range = day.ok ? ExactDates.of({ start: day.value, end: day.value, previous: null }) : undefined;\n\nexport const forged = range?.ok && Object.assign({}, range.value, { start: "2026-03-05" });\n',
  ],
]);

const isolated = config.find((block) => block.plugins?.["isolated"])?.plugins?.["isolated"];
const fixtures = mkdtempSync(join(tmpdir(), "events-guard-"));
let messages: Map<string, string[]>;

beforeAll(async () => {
  if (!isolated) throw new Error("eslint.config.js no longer registers the isolated plugin");
  const tsconfig = { extends: resolve("tsconfig.json"), include: ["*.ts"] };
  writeFileSync(join(fixtures, "tsconfig.json"), JSON.stringify(tsconfig));
  for (const [name, code] of probes) writeFileSync(join(fixtures, `${name}.ts`), code);
  const eslint = new ESLint({
    cwd: fixtures,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["*.ts"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { project: "./tsconfig.json", tsconfigRootDir: fixtures },
        },
        plugins: { isolated },
        rules: { "isolated/owned-types": "error" },
      },
    ],
  });
  const results = await eslint.lintFiles(["*.ts"]);
  messages = new Map(
    results.map(({ filePath, messages: found }) => [
      filePath,
      found.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`),
    ]),
  );
}, 60_000);

afterAll(() => rmSync(fixtures, { recursive: true, force: true }));

describe("the src/events lint guard", () => {
  it.each([...probes.keys()])("rejects building %s outside src/events", (name) => {
    expect(messages.get(join(fixtures, `${name}.ts`))).toEqual([
      expect.stringMatching(/^isolated\/owned-types: /),
    ]);
  });
});
