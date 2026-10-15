import { describe, expect, it } from "vitest";
import { parseEventArchiveSearch } from "../src/lib/event-archive";
describe("canonical event archive URL", () => {
  it("retains bounded query, year and oldest ordering on reload", () => {
    expect(parseEventArchiveSearch({ q: "Odia", year: "2025", sort: "oldest" })).toEqual({
      q: "Odia",
      year: "2025",
      sort: "oldest",
    });
  });
  it("normalizes the router JSON-decoded numeric year", () => {
    expect(parseEventArchiveSearch({ year: 2025 })).toEqual({ year: "2025" });
  });
  it.each([
    {},
    { q: 8, year: 20255, sort: "invalid" },
    { q: "x".repeat(81), year: "2025x", sort: "newest" },
  ])("drops invalid state instead of adding another archive", (state) => {
    expect(parseEventArchiveSearch(state)).toEqual({});
  });
});
