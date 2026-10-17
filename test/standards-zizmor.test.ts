import { describe, expect, it } from "vitest";
import { parseZizmor } from "../scripts/standards/zizmor";

const location = (kind: string, path: string, row: number) => ({
  symbolic: { key: { Local: { verbatim_path: path } }, kind },
  concrete: { location: { start_point: { row } } },
});
const report = (overrides: Record<string, unknown> = {}) => ({
  ident: "dangerous-triggers",
  desc: "use of fundamentally insecure workflow trigger",
  determinations: { severity: "High" },
  locations: [
    location("Related", ".github/workflows/a.yml", 1),
    location("Primary", ".github/workflows/b.yml", 2),
  ],
  ignored: false,
  ...overrides,
});

describe("parseZizmor", () => {
  it("maps each finding to its primary location", () => {
    expect(parseZizmor([report()])).toEqual([
      {
        rule: "zizmor/dangerous-triggers",
        file: ".github/workflows/b.yml",
        line: 3,
        message: "High: use of fundamentally insecure workflow trigger",
      },
    ]);
  });

  it("falls back to the first location", () => {
    const only = report({ locations: [location("Related", ".github/workflows/a.yml", 0)] });
    expect(parseZizmor([only])[0]?.file).toBe(".github/workflows/a.yml");
  });

  it("keeps findings an inline zizmor ignore comment would hide", () => {
    expect(parseZizmor([report({ ignored: true })])).toHaveLength(1);
  });

  it("rejects output it does not recognise", () => {
    expect(() => parseZizmor([{ ident: "x" }])).toThrow();
  });
});
