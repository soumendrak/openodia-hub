import { describe, it, expect } from "vitest";
import { renderErrorPage } from "../src/lib/error-page";

describe("renderErrorPage", () => {
  it("returns an HTML string", () => {
    const html = renderErrorPage();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("This page didn't load");
  });

  it("includes a refresh button", () => {
    expect(renderErrorPage()).toContain('onclick="location.reload()"');
  });

  it("includes a link to home", () => {
    expect(renderErrorPage()).toContain('href="/"');
  });
});
