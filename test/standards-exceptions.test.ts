import { describe, expect, it } from "vitest";
import {
  applyExceptions,
  checkExceptions,
  consume,
  parseExceptions,
  type Finding,
} from "../scripts/standards/exceptions";

const entry = {
  rule: "zizmor/unpinned-uses",
  file: ".github/workflows/ci.yml",
  findings: ["actions/checkout@v4", "actions/checkout@v4", "oven-sh/setup-bun@v2"],
  reason: "Pinning every action is a separate change.",
  expires: "2027-01-17",
  approvedBy: "soumendrak",
};
const finding = (key: string, line = 1): Finding => ({
  rule: entry.rule,
  file: entry.file,
  line,
  message: "High: unpinned action reference",
  key,
});
const grandfathered = [
  finding("actions/checkout@v4", 1),
  finding("oven-sh/setup-bun@v2", 2),
  finding("actions/checkout@v4", 3),
];

describe("parseExceptions", () => {
  it("accepts a well-formed file", () => {
    expect(parseExceptions({ exceptions: [entry] })).toEqual([entry]);
  });

  it.each([
    ["a missing reason", { ...entry, reason: "" }],
    ["a missing approver", { ...entry, approvedBy: "" }],
    ["a malformed expiry", { ...entry, expires: "soon" }],
    ["an impossible month", { ...entry, expires: "2027-13-01" }],
    ["an impossible day", { ...entry, expires: "2027-02-30" }],
    ["a far-future placeholder", { ...entry, expires: "9999-99-99" }],
    ["an empty finding list", { ...entry, findings: [] }],
    ["a count instead of findings", { ...entry, findings: undefined, limit: 2 }],
  ])("rejects %s", (_name, bad) => {
    expect(() => parseExceptions({ exceptions: [bad] })).toThrow();
  });
});

describe("checkExceptions", () => {
  it("accepts current, distinct entries", () => {
    expect(checkExceptions([entry], "2027-01-17")).toEqual([]);
  });

  it("fails an expired exception", () => {
    expect(checkExceptions([entry], "2027-01-18")).toEqual([
      "zizmor/unpinned-uses in .github/workflows/ci.yml: exception expired on 2027-01-17",
    ]);
  });

  it("fails duplicate entries for one rule and file", () => {
    expect(checkExceptions([entry, entry], "2026-10-17")).toEqual([
      "zizmor/unpinned-uses in .github/workflows/ci.yml: duplicate exception",
    ]);
  });
});

describe("applyExceptions", () => {
  it("allows exactly the grandfathered findings", () => {
    expect(applyExceptions(grandfathered, [entry])).toEqual({ blocking: [], problems: [] });
  });

  it("blocks a new finding swapped in for a fixed one, replaying the count-only gap", () => {
    const swapped = [...grandfathered.slice(0, 2), finding("actions/upload-artifact@v4", 9)];
    expect(applyExceptions(swapped, [entry])).toEqual({
      blocking: [finding("actions/upload-artifact@v4", 9)],
      problems: [
        "zizmor/unpinned-uses in .github/workflows/ci.yml: no longer found, remove from scripts/standards/exceptions.json: actions/checkout@v4",
      ],
    });
  });

  it("blocks one more copy of a grandfathered finding", () => {
    const extra = [...grandfathered, finding("actions/checkout@v4", 7)];
    expect(applyExceptions(extra, [entry]).blocking).toEqual([finding("actions/checkout@v4", 7)]);
  });

  it("blocks findings with no exception", () => {
    const other = { ...finding("x"), file: ".github/workflows/new.yml" };
    expect(applyExceptions([other], [entry]).blocking).toEqual([other]);
  });
});

describe("consume", () => {
  it("removes one matching copy and reports whether it found one", () => {
    const pool = ["a", "a"];
    expect(consume(pool, "a")).toBe(true);
    expect(pool).toEqual(["a"]);
    expect(consume(pool, "b")).toBe(false);
  });
});
