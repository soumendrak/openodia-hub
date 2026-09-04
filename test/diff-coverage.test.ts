import { describe, expect, it } from "vitest";
import {
  assessDiffCoverage,
  isCoverageInput,
  isMeasuredSource,
  parseChangedLines,
  type IstanbulCoverage,
} from "../src/lib/diff-coverage";

describe("diff coverage", () => {
  it("parses added line ranges, replacements, new files, and deletions", () => {
    const diff = [
      "diff --git a/src/one.ts b/src/one.ts",
      "--- a/src/one.ts",
      "+++ b/src/one.ts",
      "@@ -2 +2,2 @@",
      "-old",
      "+new",
      "+another",
      "diff --git a/src/new.ts b/src/new.ts",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1 @@",
      "+export const value = 1;",
      "diff --git a/src/gone.ts b/src/gone.ts",
      "--- a/src/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
    ].join("\n");

    expect([...parseChangedLines(diff)]).toEqual([
      ["src/one.ts", new Set([2, 3])],
      ["src/new.ts", new Set([1])],
    ]);
  });

  it("reports only uncovered executable lines in measured source", () => {
    const changed = new Map([
      ["src/covered.ts", new Set([1, 2, 3, 4])],
      ["src/missing.ts", new Set([1])],
      ["test/covered.test.ts", new Set([1])],
    ]);
    const coverage: IstanbulCoverage = {
      "/repo/src/covered.ts": {
        path: "/repo/src/covered.ts",
        statementMap: {
          "0": { start: { line: 1 }, end: { line: 1 } },
          "1": { start: { line: 2 }, end: { line: 2 } },
          "2": { start: { line: 2 }, end: { line: 2 } },
          "3": { start: { line: 4 }, end: { line: 4 } },
        },
        s: { "0": 1, "1": 0, "2": 2 },
      },
    };

    expect(assessDiffCoverage(changed, coverage, "/repo/")).toEqual({
      checked: [
        { file: "src/covered.ts", line: 1 },
        { file: "src/covered.ts", line: 2 },
        { file: "src/covered.ts", line: 4 },
      ],
      uncovered: [{ file: "src/covered.ts", line: 4 }],
      missingFiles: ["src/missing.ts"],
    });
  });

  it("normalizes relative coverage paths and sorts files and lines", () => {
    const changed = new Map([
      ["scripts/z.mjs", new Set([3, 1])],
      ["src/a.ts", new Set([2])],
    ]);
    const coverage: IstanbulCoverage = {
      z: {
        path: "./scripts/z.mjs",
        statementMap: {
          "0": { start: { line: 3 }, end: { line: 3 } },
          "1": { start: { line: 1 }, end: { line: 1 } },
        },
        s: { "0": 1, "1": 1 },
      },
      a: {
        path: "src/a.ts",
        statementMap: { "0": { start: { line: 2 }, end: { line: 2 } } },
        s: { "0": 1 },
      },
    };

    expect(assessDiffCoverage(changed, coverage, "/repo").checked).toEqual([
      { file: "scripts/z.mjs", line: 1 },
      { file: "scripts/z.mjs", line: 3 },
      { file: "src/a.ts", line: 2 },
    ]);
  });

  it("checks changed continuation lines against the full statement range", () => {
    const changed = new Map([["src/multiline.ts", new Set([2, 3, 5])]]);
    const coverage: IstanbulCoverage = {
      multiline: {
        path: "/repo/src/multiline.ts",
        statementMap: {
          "0": { start: { line: 1 }, end: { line: 3 } },
          "1": { start: { line: 4 }, end: { line: 5 } },
        },
        s: { "0": 0, "1": 1 },
      },
    };

    expect(assessDiffCoverage(changed, coverage, "/repo")).toEqual({
      checked: [
        { file: "src/multiline.ts", line: 2 },
        { file: "src/multiline.ts", line: 3 },
        { file: "src/multiline.ts", line: 5 },
      ],
      uncovered: [
        { file: "src/multiline.ts", line: 2 },
        { file: "src/multiline.ts", line: 3 },
      ],
      missingFiles: [],
    });
  });

  it("classifies measured, generated, test, and configuration files", () => {
    for (const extension of ["js", "cjs", "mjs", "jsx", "ts", "cts", "mts", "tsx"]) {
      expect(isMeasuredSource(`./src/lib/value.${extension}`)).toBe(true);
      expect(isMeasuredSource(`scripts/task.${extension}`)).toBe(true);
    }
    expect(isMeasuredSource("src/lib/value.cjsx")).toBe(false);
    expect(isMeasuredSource("scripts/task.mtsx")).toBe(false);
    expect(isMeasuredSource("src/routeTree.gen.ts")).toBe(false);
    expect(isMeasuredSource("scripts/check-diff-coverage.mjs")).toBe(false);
    expect(isMeasuredSource("README.md")).toBe(false);
    expect(isCoverageInput("test/value.test.tsx")).toBe(true);
    expect(isCoverageInput("vitest.config.ts")).toBe(true);
    expect(isCoverageInput("vite.config.ts")).toBe(true);
    expect(isCoverageInput("tsconfig.json")).toBe(true);
    expect(isCoverageInput("package.json")).toBe(true);
    expect(isCoverageInput("bun.lock")).toBe(true);
    expect(isCoverageInput("README.md")).toBe(false);
  });
});
