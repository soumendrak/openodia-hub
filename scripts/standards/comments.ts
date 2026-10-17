import ts from "typescript";
import type { Finding } from "./exceptions";

export const COMMENT_RULE = "no-new-comments";

const SCANNED = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const GENERATED = new Set(["src/routeTree.gen.ts"]);

export function isCommentScanned(file: string): boolean {
  return SCANNED.test(file) && !GENERATED.has(file);
}

const literalKinds = new Set([
  ts.SyntaxKind.JsxText,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

type Comment = { line: number; endLine: number; text: string };

export function findComments(file: string, text: string): Comment[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const ranges = new Map<number, number>();
  const literals: [number, number][] = [];
  const visit = (node: ts.Node): void => {
    const literal = literalKinds.has(node.kind);
    const jsxText = node.kind === ts.SyntaxKind.JsxText;
    if (literal) literals.push([jsxText ? node.pos : node.getStart(source), node.end]);
    const around = [
      ...(jsxText ? [] : (ts.getLeadingCommentRanges(text, node.pos) ?? [])),
      ...(ts.getTrailingCommentRanges(text, node.end) ?? []),
    ];
    for (const range of around) ranges.set(range.pos, range.end);
    if (!literal) node.getChildren(source).forEach(visit);
  };
  visit(source);
  const line = (pos: number) => source.getLineAndCharacterOfPosition(pos).line + 1;
  return [...ranges]
    .filter(([pos]) => !literals.some(([start, end]) => pos >= start && pos < end))
    .sort(([a], [b]) => a - b)
    .map(([pos, end]) => ({ line: line(pos), endLine: line(end - 1), text: text.slice(pos, end) }));
}

export function newComments(
  file: string,
  text: string,
  changed: ReadonlySet<number>,
  before = "",
): Finding[] {
  const old = findComments(file, before).map((comment) => comment.text);
  return findComments(file, text)
    .filter(({ line, endLine }) => [...changed].some((n) => n >= line && n <= endLine))
    .filter((comment) => {
      const index = old.indexOf(comment.text);
      if (index >= 0) old.splice(index, 1);
      return index < 0;
    })
    .map(({ line, endLine }) => ({
      rule: COMMENT_RULE,
      file,
      line,
      message:
        line === endLine
          ? `new comment on line ${line}`
          : `new comment on lines ${line}-${endLine}`,
    }));
}
