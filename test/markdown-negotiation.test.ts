import { describe, expect, it } from "vitest";
import { estimateTokens, htmlToMarkdown } from "../src/lib/html-to-markdown";
import { toMarkdownResponse, wantsMarkdown } from "../src/server";

const page = (body: string, title = "About · OpenOdia") =>
  `<!DOCTYPE html><html><head><title>${title}</title>` +
  `<style>.a{color:red}</style></head><body>${body}` +
  `<script>self.$R=[]</script></body></html>`;

describe("wantsMarkdown", () => {
  it.each([
    ["text/markdown", true],
    ["text/markdown, text/html;q=0.9", true],
    ["text/html, text/markdown;q=0.8", true],
    ["TEXT/MARKDOWN", true],
    ["text/html", false],
    ["*/*", false],
    ["application/json", false],
  ])("accept %s -> %s", (accept, expected) => {
    expect(wantsMarkdown(new Request("https://openodia.com/", { headers: { accept } }))).toBe(
      expected,
    );
  });

  it("ignores non-GET requests", () => {
    const request = new Request("https://openodia.com/", {
      method: "POST",
      headers: { accept: "text/markdown" },
    });
    expect(wantsMarkdown(request)).toBe(false);
  });
});

describe("htmlToMarkdown", () => {
  it("leads with the page title and keeps heading levels", () => {
    const md = htmlToMarkdown(page("<h1>Hello</h1><h3>Deep</h3>"));
    expect(md).toBe("# About · OpenOdia\n\n# Hello\n\n### Deep");
  });

  it("drops script, style, svg and comment noise", () => {
    const md = htmlToMarkdown(page('<p>Kept<svg><path d="M0 0"/></svg><!-- --> text</p>'));
    expect(md).toContain("Kept text");
    expect(md).not.toContain("path");
    expect(md).not.toContain("$R");
    expect(md).not.toContain("color:red");
  });

  it("renders links, emphasis and images", () => {
    const md = htmlToMarkdown(
      page('<p>See <a href="/tools"><strong>tools</strong></a> <img src="/l.svg" alt="Logo"/></p>'),
    );
    expect(md).toContain("See [**tools**](/tools) ![Logo](/l.svg)");
  });

  it("numbers ordered lists and indents nested ones", () => {
    const md = htmlToMarkdown(page("<ol><li>one</li><li>two<ul><li>inner</li></ul></li></ol>"));
    expect(md).toContain("1. one");
    expect(md).toContain("2. two");
    expect(md).toContain("  - inner");
  });

  it("fences code blocks and preserves their whitespace", () => {
    const md = htmlToMarkdown(page("<pre><code>a\n  b</code></pre>"));
    expect(md).toContain("```\na\n  b\n```");
  });

  it("decodes entities, including numeric ones", () => {
    expect(htmlToMarkdown(page("<p>a &amp; b &#169; &#x2014; &ldquo;c&rdquo;</p>"))).toContain(
      "a & b © — “c”",
    );
  });

  it("collapses whitespace without gluing inline words together", () => {
    const md = htmlToMarkdown(page("<p>  a\n\n  b  </p><p><b>c</b> <b>d</b></p>"));
    expect(md).toContain("a b");
    expect(md).toContain("**c** **d**");
    expect(md).not.toMatch(/\n{3}/);
  });
});

describe("toMarkdownResponse", () => {
  const html = (init?: ResponseInit) =>
    new Response(page("<h1>Hi</h1>"), {
      headers: { "content-type": "text/html; charset=utf-8" },
      ...init,
    });

  it("converts HTML and sets the negotiated headers", async () => {
    const res = await toMarkdownResponse(html());
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    const body = await res.text();
    expect(body).toContain("# Hi");
    expect(res.headers.get("x-markdown-tokens")).toBe(String(estimateTokens(body)));
  });

  it("keeps status and does not duplicate an existing Vary: Accept", async () => {
    const res = await toMarkdownResponse(
      new Response(page("<p>gone</p>"), {
        status: 404,
        headers: { "content-type": "text/html", vary: "Accept-Encoding, Accept" },
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("vary")).toBe("Accept-Encoding, Accept");
  });

  it("passes non-HTML responses through untouched", async () => {
    const json = new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    });
    const res = await toMarkdownResponse(json);
    expect(res).toBe(json);
    expect(res.headers.get("x-markdown-tokens")).toBeNull();
  });
});
