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

  it("drops an <img> with no src attribute but keeps surrounding spacing", () => {
    const md = htmlToMarkdown(page('<p>a <img alt="x"> b</p>'));
    expect(md).not.toContain("![");
    expect(md).toContain("a");
    expect(md).toContain("b");
  });

  it("renders an <img> with a src but no alt using empty alt text", () => {
    const md = htmlToMarkdown(page('<p><img src="/x.png"></p>'));
    expect(md).toContain("![](/x.png)");
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

  it("leaves invalid numeric and unknown named entities untouched", () => {
    const md = htmlToMarkdown(page("<p>&#0; &#a1; &unknown;</p>"));
    expect(md).toContain("&#0; &#a1; &unknown;");
  });

  it("reads single-quoted and unquoted attribute values", () => {
    const single = htmlToMarkdown(page("<p><a href='/plain'>x</a></p>"));
    expect(single).toContain("[x](/plain)");
    const unquoted = htmlToMarkdown(page("<p><a href=/plain>x</a></p>"));
    expect(unquoted).toContain("[x](/plain)");
  });

  it("collapses whitespace without gluing inline words together", () => {
    const md = htmlToMarkdown(page("<p>  a\n\n  b  </p><p><b>c</b> <b>d</b></p>"));
    expect(md).toContain("a b");
    expect(md).toContain("**c** **d**");
    expect(md).not.toMatch(/\n{3}/);
  });

  it("does not stack a second separator space after a no-output tag", () => {
    // The empty <a></a> (no href) pushes nothing, so two whitespace-only text
    // runs land back to back; the second must not add a redundant space.
    const md = htmlToMarkdown(page("<p><b>c</b> <a></a> <b>d</b></p>"));
    expect(md).toContain("**c** **d**");
    expect(md).not.toContain("**c**  **d**");
  });

  it("inserts a line break for <br> and ignores a stray </br>", () => {
    const md = htmlToMarkdown(page("<p>line1<br></br>line2</p>"));
    expect(md).toContain("line1\nline2");
  });

  it("renders a horizontal rule for <hr> and ignores a stray </hr>", () => {
    const md = htmlToMarkdown(page("<hr></hr><p>after</p>"));
    expect(md).toBe("# About · OpenOdia\n\n---\n\nafter");
  });

  it("drops a stray closing </img> tag without emitting markdown for it", () => {
    const md = htmlToMarkdown(page("<p>a</img>b</p>"));
    expect(md).toContain("ab");
    expect(md).not.toContain("![");
  });

  it("wraps <em> and <i> text in underscores", () => {
    const md = htmlToMarkdown(page("<p><em>a</em> <i>b</i></p>"));
    expect(md).toContain("_a_ _b_");
  });

  it("backticks inline <code> outside of a <pre> block", () => {
    const md = htmlToMarkdown(page("<p>Use <code>foo()</code> here</p>"));
    expect(md).toContain("Use `foo()` here");
  });

  it("separates table cells and rows for <th>/<td>/<tr>", () => {
    const md = htmlToMarkdown(
      page("<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ann</td><td>30</td></tr></table>"),
    );
    expect(md).toContain("Name | Age |");
    expect(md).toContain("Ann | 30 |");
  });

  it("omits the link wrapper entirely when the anchor has no href", () => {
    const md = htmlToMarkdown(page("<p>See <a>bare</a> link</p>"));
    expect(md).toContain("See bare link");
    expect(md).not.toContain("[bare]");
  });

  it("falls back to bare markdown when there is no <title> tag", () => {
    const md = htmlToMarkdown("<html><body><p>No title here</p></body></html>");
    expect(md).toBe("No title here");
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
