// Minimal HTML -> Markdown serializer for the `Accept: text/markdown` path in
// src/server.ts. Deliberately not a general-purpose converter: the only input it
// ever sees is our own React SSR output, which is well-formed and tag-balanced.
//
// ponytail: hand-rolled instead of pulling in turndown (~30KB into the Worker
// bundle) — swap it in if we ever need to convert third-party HTML.

/** Subtrees that carry no reader-facing content. */
const DROPPED = /<(script|style|svg|noscript|template|head|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const DOCTYPE = /<!DOCTYPE[^>]*>/gi;
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)\/?>/g;
const ATTR = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

const HEADING = /^h([1-6])$/;
/** Tags whose boundaries force a blank line in the output. */
const BLOCK = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "header",
  "hgroup",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "summary",
  "table",
  "ul",
]);

export function htmlToMarkdown(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const body = html.replace(COMMENTS, "").replace(DOCTYPE, "").replace(DROPPED, "");

  const out: string[] = [];
  /** One entry per open <ul>/<ol>; `undefined` marks an unordered list. */
  const lists: Array<number | undefined> = [];
  const hrefs: string[] = [];
  let preDepth = 0;

  const push = (text: string) => {
    if (text) out.push(text);
  };
  /** Drop pending newlines so separators never stack up. */
  const rewind = () => {
    while (out.length && /^\n*$/.test(out[out.length - 1])) out.pop();
  };
  /** Blank line between blocks. */
  const block = () => {
    rewind();
    if (out.length) out.push("\n\n");
  };
  /** Single break — list items stay tight instead of going loose. */
  const line = () => {
    rewind();
    if (out.length) out.push("\n");
  };

  let cursor = 0;
  const text = (raw: string) => {
    if (!raw) return;
    const decoded = decodeEntities(raw);
    if (preDepth > 0) {
      push(decoded);
      return;
    }
    const collapsed = decoded.replace(/\s+/g, " ");
    // Drop whitespace-only runs that sit between block tags; keep the ones that
    // separate inline text ("<b>a</b> <b>b</b>").
    if (!collapsed.trim()) {
      const prev = out[out.length - 1];
      if (prev && !prev.endsWith(" ") && !prev.endsWith("\n")) push(" ");
      return;
    }
    push(collapsed);
  };

  for (const match of body.matchAll(TAG)) {
    text(body.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const heading = HEADING.exec(tag);

    if (heading) {
      block();
      if (!closing) push(`${"#".repeat(Number(heading[1]))} `);
      continue;
    }

    switch (tag) {
      case "br":
        if (!closing) push("\n");
        break;
      case "hr":
        if (!closing) {
          block();
          push("---");
          block();
        }
        break;
      case "img": {
        if (closing) break;
        const { src, alt } = attrs(match[3]);
        if (src) push(`![${alt ?? ""}](${src})`);
        break;
      }
      case "a": {
        if (closing) {
          const href = hrefs.pop();
          push(href ? `](${href})` : "");
        } else {
          const href = attrs(match[3]).href;
          hrefs.push(href ?? "");
          push(href ? "[" : "");
        }
        break;
      }
      case "strong":
      case "b":
        push("**");
        break;
      case "em":
      case "i":
        push("_");
        break;
      case "code":
        if (preDepth === 0) push("`");
        break;
      case "pre":
        if (closing) {
          preDepth = Math.max(0, preDepth - 1);
          push("\n```");
          block();
        } else {
          preDepth += 1;
          block();
          push("```\n");
        }
        break;
      case "ul":
      case "ol":
        // A nested list continues its parent item; a top-level one starts a block.
        if (lists.length) line();
        else block();
        if (closing) lists.pop();
        else lists.push(tag === "ol" ? 1 : undefined);
        break;
      case "li": {
        if (closing) break;
        line();
        const depth = Math.max(0, lists.length - 1);
        const counter = lists[lists.length - 1];
        const marker = counter === undefined ? "-" : `${counter}.`;
        if (counter !== undefined) lists[lists.length - 1] = counter + 1;
        push(`${"  ".repeat(depth)}${marker} `);
        break;
      }
      case "th":
      case "td":
        push(closing ? " | " : "");
        break;
      case "tr":
        block();
        break;
      default:
        if (BLOCK.has(tag)) block();
    }
  }
  text(body.slice(cursor));

  const markdown = out
    .join("")
    // Icon-only anchors lose their <svg> and would otherwise leave `[](href)`.
    .replace(/(?<!!)\[\]\([^)]*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // The page's own <h1> lives below the nav, so lead with <title> to tell an
  // agent what it is looking at before the chrome scrolls past.
  const label = title ? decodeEntities(title).trim() : "";
  return label ? `# ${label}\n\n${markdown}` : markdown;
}

/** Rough token estimate for the `x-markdown-tokens` header (~4 chars/token). */
export function estimateTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}
