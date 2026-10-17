import { describe, expect, it } from "vitest";
import { applyExceptions, parseExceptions, type Finding } from "../scripts/standards/exceptions";

const entry = {
  rule: "zizmor/unpinned-uses",
  file: ".github/workflows/ci.yml",
  limit: 2,
  reason: "Pinning every action is a separate change.",
  expires: "2027-01-17",
  approvedBy: "soumendrak",
};
const finding = (line: number): Finding => ({
  rule: entry.rule,
  file: entry.file,
  line,
  message: "unpinned action reference",
});

describe("parseExceptions", () => {
  it("accepts a well-formed file", () => {
    expect(parseExceptions({ exceptions: [entry] })).toEqual([entry]);
  });

  it.each([
    ["a missing reason", { ...entry, reason: "" }],
    ["a missing approver", { ...entry, approvedBy: "" }],
    ["a malformed expiry", { ...entry, expires: "soon" }],
    ["a zero limit", { ...entry, limit: 0 }],
    ["an unknown key", { ...entry, line: 3 }],
  ])("rejects %s", (_name, bad) => {
    expect(() => parseExceptions({ exceptions: [bad] })).toThrow();
  });
});

describe("applyExceptions", () => {
  it("allows findings up to the recorded limit", () => {
    expect(applyExceptions([finding(1), finding(2)], [entry], "2026-10-17")).toEqual({
      blocking: [],
      problems: [],
    });
  });

  it("blocks every finding in a group that exceeds its limit", () => {
    const result = applyExceptions([finding(1), finding(2), finding(3)], [entry], "2026-10-17");
    expect(result.blocking).toHaveLength(3);
    expect(result.problems).toEqual([
      "zizmor/unpinned-uses in .github/workflows/ci.yml: 3 found, 2 allowed by scripts/standards/exceptions.json",
    ]);
  });

  it("blocks findings with no exception", () => {
    const other = { ...finding(9), file: ".github/workflows/new.yml" };
    expect(applyExceptions([other], [entry], "2026-10-17").blocking).toEqual([other]);
  });

  it("fails an expired exception", () => {
    expect(applyExceptions([], [entry], "2027-01-18").problems).toEqual([
      "zizmor/unpinned-uses in .github/workflows/ci.yml: exception expired on 2027-01-17",
    ]);
  });

  it("fails duplicate entries for one rule and file", () => {
    expect(applyExceptions([], [entry, entry], "2026-10-17").problems).toEqual([
      "zizmor/unpinned-uses in .github/workflows/ci.yml: duplicate exception",
    ]);
  });
});
