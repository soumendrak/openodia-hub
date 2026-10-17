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

const apply = (found: readonly Finding[]) => applyExceptions(found, [entry]);

describe("applyExceptions", () => {
  it("allows exactly the grandfathered findings", () => {
    expect(apply(grandfathered)).toEqual({ blocking: [], problems: [] });
  });

  it("blocks a new finding swapped in for a fixed one, replaying the count-only gap", () => {
    const swapped = [...grandfathered.slice(0, 2), finding("actions/upload-artifact@v4", 9)];
    expect(apply(swapped)).toEqual({
      blocking: [finding("actions/upload-artifact@v4", 9)],
      problems: [
        "zizmor/unpinned-uses in .github/workflows/ci.yml: no longer found, remove from scripts/standards/exceptions.json: actions/checkout@v4",
      ],
    });
  });

  it("blocks one more copy of a grandfathered finding", () => {
    const extra = [...grandfathered, finding("actions/checkout@v4", 7)];
    expect(apply(extra).blocking).toEqual([finding("actions/checkout@v4", 7)]);
  });

  it("blocks findings with no exception", () => {
    const other = { ...finding("x"), file: ".github/workflows/new.yml" };
    expect(apply([other]).blocking).toEqual([other]);
  });

  it("approves listed copies that are present even when no new finding uses them", () => {
    const present = () => ["actions/checkout@v4", "actions/checkout@v4", "oven-sh/setup-bun@v2"];
    expect(applyExceptions([], [entry], present)).toEqual({ blocking: [], problems: [] });
    const extra = finding("actions/checkout@v4", 9);
    const more = () => [...present(), "actions/checkout@v4"];
    expect(applyExceptions([extra], [entry], more).blocking).toEqual([extra]);
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
