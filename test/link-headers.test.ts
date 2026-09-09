import { describe, expect, it } from "vitest";
import { withAgentLinks } from "../src/server";

describe("withAgentLinks", () => {
  it("adds RFC 8288 Link relations to HTML responses", () => {
    const res = withAgentLinks(
      new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    const link = res.headers.get("Link") ?? "";
    expect(link).toContain('rel="service-desc"');
    expect(link).toContain('rel="service-doc"');
  });

  it("leaves non-HTML responses untouched", () => {
    const res = withAgentLinks(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    expect(res.headers.get("Link")).toBeNull();
  });

  it("preserves existing headers and status", () => {
    const res = withAgentLinks(
      new Response("<html></html>", {
        status: 404,
        headers: { "content-type": "text/html", "x-keep": "1" },
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("x-keep")).toBe("1");
  });
});
