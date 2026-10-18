import { readFileSync } from "node:fs";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import config from "../../eslint.config.js";

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });

const MODEL = "src/events/model.ts";
const model = ts.createSourceFile(MODEL, readFileSync(MODEL, "utf8"), ts.ScriptTarget.Latest);
const exported = model.statements.filter(
  (statement) =>
    ts.canHaveModifiers(statement) &&
    ts.getModifiers(statement)?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword),
);
const types = exported.filter(ts.isTypeAliasDeclaration).map(({ name }) => name.text);
const values = exported.flatMap((statement) =>
  ts.isFunctionDeclaration(statement) && statement.name
    ? [statement.name.text]
    : ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap(({ name }) =>
          ts.isIdentifier(name) ? [name.text] : [],
        )
      : [],
);

const assertion =
  "isolated/owned-types: Build src/events values with the functions in src/events, never with a type assertion.";

async function lint(code: string) {
  const [result] = await eslint.lintText(code, { filePath: "src/routes/fixture.ts" });
  return result?.messages.map(({ ruleId, message }) => `${ruleId ?? "fatal"}: ${message}`);
}

describe("the src/events lint guard", () => {
  it("reads every exported type and function of the model", () => {
    expect(types).toEqual(
      expect.arrayContaining(["CanonicalEvent", "Dates", "ExactDates", "IsoDay", "Text", "Field"]),
    );
    expect(values).toEqual(expect.arrayContaining(["dates", "isoDay", "join", "applyCorrection"]));
  });

  it.each(types)("rejects asserting to %s outside src/events", async (name) => {
    const code = `import type { ${name} } from "@/events/model";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ${name};\n`;
    expect(await lint(code)).toEqual([assertion]);
  });

  it.each(values)("rejects asserting to what %s returns outside src/events", async (name) => {
    const code = `import { ${name} } from "@/events/model";\n\ndeclare const raw: unknown;\n\nexport const value = raw as ReturnType<typeof ${name}>;\n`;
    expect(await lint(code)).toEqual([assertion]);
  });

  it.each([
    '{ kind: "exact", start: "2026-04-10", end: "2026-03-05", previous: null } as unknown as ExactDates',
    '"2026-02-30" as IsoDay',
    '"" as Text',
    "raw as Dates",
  ])("rejects the reviewed bypass %s", async (expression) => {
    const code = `import type { Dates, ExactDates, IsoDay, Text } from "@/events/model";\n\ndeclare const raw: unknown;\n\nexport const value =\n  ${expression};\n`;
    expect((await lint(code))?.filter((message) => message.startsWith("isolated/"))).toEqual([
      assertion,
    ]);
  });

  it("keeps the model and its tests lint-clean", async () => {
    const results = await eslint.lintFiles([MODEL, "test/events/model.test.ts"]);
    expect(results.flatMap(({ messages }) => messages)).toEqual([]);
  });
});
