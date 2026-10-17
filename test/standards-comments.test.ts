import { describe, expect, it } from "vitest";
import { findComments, isCommentScanned, newComments } from "../scripts/standards/comments";

const count = (file: string, text: string) => findComments(file, text).length;

describe("findComments", () => {
  it.each([
    ["trailing line comment", "const a = 1; // trailing\n", 1],
    ["block after code", "const o = { a: 1 }; /* block */\n", 1],
    ["leading line comment", "// line\nexport {};\n", 1],
    ["doc comment", "/** jsdoc */\nexport const z = 1;\n", 1],
    ["comment inside a template expression", "const t = `${f(`n`) /* c */}`;\n", 1],
    ["comment after a quoted brace", 'const t = `${ "}" /* c */ }`;\n', 1],
    ["nested template expression", "const a = 1; const n = `${`${a /* deep */}`}`;\n", 1],
    ["comment in an empty block", "function f() { /* empty */ }\n", 1],
    ["slashes in a regex", "const re = /https?:\\/\\//;\n", 0],
    ["url in a template", "const t = `http://x`;\n", 0],
    ["slashes in a string", 'const s = "a // b";\n', 0],
    ["text after a quoted brace", 'const t = `${"}"} // text`;\n', 0],
    [
      "regex after await",
      "async function g(s: string) { return `${await /x\\/\\//.test(s)}`; }\n",
      0,
    ],
    ["division", "const a = 4, b = 2; const x = a / b / a;\n", 0],
    ["block marker in a regex", 'const u = "x".replace(/\\/\\*/g, "");\n', 0],
    ["block marker in single quotes", "const s = '/* not */';\n", 0],
    ["regex class with a slash", "const q = /[/]/;\n", 0],
    ["block marker in template text", "const p = `a/*b*/c`;\n", 0],
    ["shebang", "#!/usr/bin/env bun\nexport {};\n", 0],
  ])("%s", (_name, text, expected) => {
    expect(count("x.ts", text)).toBe(expected);
  });

  it.each([
    ["comment in a JSX expression", "export const J = () => <div>{/* jsx */}</div>;\n", 1],
    ["slashes in JSX text", "export const J = () => <p>a // b</p>;\n", 0],
    ["JSX text that starts with slashes", "export const J = () => <p> // b</p>;\n", 0],
    ["url in a JSX attribute", 'export const J = () => <a href="https://x.org">x</a>;\n', 0],
  ])("%s", (_name, text, expected) => {
    expect(count("x.tsx", text)).toBe(expected);
  });

  it("parses plain JavaScript modules", () => {
    expect(count("x.mjs", "export const a = 1; // c\n")).toBe(1);
    expect(count("x.jsx", "export const J = () => <p>{/* c */}</p>;\n")).toBe(1);
  });

  it("orders comments by position", () => {
    expect(findComments("x.ts", "export const a = [1, /* one */ 2]; // two\n// three\n")).toEqual([
      { line: 1, endLine: 1, text: "/* one */" },
      { line: 1, endLine: 1, text: "// two" },
      { line: 2, endLine: 2, text: "// three" },
    ]);
  });

  it("reports the lines each comment spans", () => {
    expect(findComments("x.ts", "export const a = 1;\n/*\nplain\n*/\n")).toEqual([
      { line: 2, endLine: 4, text: "/*\nplain\n*/" },
    ]);
  });
});

describe("newComments", () => {
  const block = "/*\n  old\n  added prose line\n*/\nexport const a = 1;\n";

  it("flags a line added inside an existing block comment", () => {
    expect(newComments("src/a.ts", block, new Set([3]))).toEqual([
      { rule: "no-new-comments", file: "src/a.ts", line: 1, message: "new comment on lines 1-4" },
    ]);
  });

  it("still flags the edited block when its earlier version is known", () => {
    const before = "/*\n  old\n*/\nexport const a = 1;\n";
    expect(newComments("src/a.ts", block, new Set([3]), before)).toHaveLength(1);
  });

  it("keeps an existing trailing comment when only the code on its line changes", () => {
    const before = "export const c = 1; // default\n";
    const after = "export const c = 2; // default\n";
    expect(newComments("src/c.ts", after, new Set([1]), before)).toEqual([]);
  });

  it("flags each copy of a comment beyond the copies that already existed", () => {
    const before = "export const c = 1; // same\n";
    const after = "export const c = 1; // same\nexport const d = 1; // same\n";
    expect(newComments("src/c.ts", after, new Set([1, 2]), before)).toEqual([
      { rule: "no-new-comments", file: "src/c.ts", line: 2, message: "new comment on line 2" },
    ]);
  });

  it("ignores comments on unchanged lines", () => {
    expect(newComments("src/a.ts", block, new Set([5]))).toEqual([]);
  });

  it("ignores slashes and stars added inside a multi-line template", () => {
    const text = "export const t = `\nx\nsee a // b here\n * bullet\n`;\n";
    expect(newComments("src/t.ts", text, new Set([3, 4]))).toEqual([]);
  });
});

describe("isCommentScanned", () => {
  it.each([
    ["src/a.ts", true],
    ["src/a.tsx", true],
    ["scripts/a.mjs", true],
    ["test/a.test.ts", true],
    ["src/routeTree.gen.ts", false],
    ["README.md", false],
    [".github/workflows/ci.yml", false],
  ])("%s", (file, expected) => {
    expect(isCommentScanned(file)).toBe(expected);
  });
});
