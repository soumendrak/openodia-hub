import ts from "typescript";
import { consume } from "./exceptions";

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

type Comment = { line: number; endLine: number; text: string };

export function findComments(file: string, text: string): Comment[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
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

export function newComments(file: string, text: string, lines: ReadonlySet<number>, before = "") {
  const old = findComments(file, before).map((comment) => comment.text);
  const comments = findComments(file, text);
  const touched = ({ line, endLine }: Comment) => [...lines].some((n) => n >= line && n <= endLine);
  for (const comment of comments) if (!touched(comment)) consume(old, comment.text);
  return comments
    .filter((comment) => touched(comment) && !consume(old, comment.text))
    .map(({ line, endLine, text: comment }) => ({
      rule: COMMENT_RULE,
      file,
      line,
      message: `new comment on ${line === endLine ? `line ${line}` : `lines ${line}-${endLine}`}`,
      key: comment,
    }));
}
