import { describe, it, expect } from "vitest";
import { licenseFromProse, normalizeSpdx, isPermissive } from "../src/lib/license";
import { toBibTeX, toApa } from "../src/lib/citation";
import { buildFacet, toggleValue } from "../src/lib/facets";
import { prettySize, sizeRank } from "../src/lib/dataset-size";
import { summarize } from "../src/lib/sources/huggingface";

describe("normalizeSpdx", () => {
  it("canonicalises the casing each source uses", () => {
    expect(normalizeSpdx("apache-2.0")).toBe("Apache-2.0");
    expect(normalizeSpdx("MIT")).toBe("MIT");
    expect(normalizeSpdx("cc-by-4.0")).toBe("CC-BY-4.0");
  });

  it("refuses to guess", () => {
    expect(normalizeSpdx("NOASSERTION")).toBe("");
    expect(normalizeSpdx("other")).toBe("");
    expect(normalizeSpdx("some-bespoke-license")).toBe("");
    expect(normalizeSpdx(null)).toBe("");
  });
});

describe("licenseFromProse", () => {
  it("reads the inline form Awesome-Odia-AI uses", () => {
    expect(
      licenseFromProse("English↔Odia translation model based on mT5 (300M params, Apache-2.0)."),
    ).toBe("Apache-2.0");
    expect(licenseFromProse("Named Entity Recognition model for Odia (MIT license)")).toBe("MIT");
    expect(licenseFromProse("Large instruction dataset for Odia (CC-BY-4.0).")).toBe("CC-BY-4.0");
  });

  it("prefers the longer id when two overlap", () => {
    expect(licenseFromProse("Corpus released under CC-BY-SA-4.0.")).toBe("CC-BY-SA-4.0");
  });

  it("returns nothing rather than a wrong badge", () => {
    expect(licenseFromProse("A permissively licensed Odia corpus.")).toBe("");
    expect(licenseFromProse("Uses the mit-scheme interpreter")).toBe("");
    expect(licenseFromProse("")).toBe("");
  });
});

describe("isPermissive", () => {
  it("separates reuse-without-strings from the rest", () => {
    expect(isPermissive("Apache-2.0")).toBe(true);
    expect(isPermissive("CC-BY-NC-4.0")).toBe(false);
    expect(isPermissive("GPL-3.0")).toBe(false);
    expect(isPermissive("")).toBe(false);
  });
});

describe("citations", () => {
  const entry = {
    name: "OdiEnCorp-2.0",
    author: "shantipriyap",
    url: "https://github.com/shantipriyap/OdiEnCorp-2.0",
    createdAt: "2020-04-11T10:00:00Z",
  };

  it("renders a @misc entry from catalog facts only", () => {
    const bib = toBibTeX(entry);
    expect(bib).toContain("@misc{shantipriyap_odiencorp_2_0_2020,");
    expect(bib).toContain("title = {OdiEnCorp-2.0}");
    expect(bib).toContain("year = {2020}");
    expect(bib).toContain("\\url{https://github.com/shantipriyap/OdiEnCorp-2.0}");
  });

  it("omits the year rather than inventing one", () => {
    const bib = toBibTeX({ ...entry, createdAt: undefined });
    expect(bib).not.toContain("year =");
    expect(toApa({ ...entry, createdAt: undefined })).toContain("(n.d.)");
  });

  it("strips braces that would terminate a BibTeX field", () => {
    expect(toBibTeX({ ...entry, name: "od{ia}\\corpus" })).toContain("title = {odiacorpus}");
  });
});

describe("summarize", () => {
  it("cuts an HF dataset card down to two sentences", () => {
    const card =
      "# Odia corpus\n\nThis is a large Odia corpus. It has three splits. It was built from news sources in 2021. And more text follows here forever.";
    const out = summarize(card);
    expect(out).toBe("This is a large Odia corpus. It has three splits.");
  });

  it("drops the HF boilerplate tail", () => {
    expect(
      summarize("A parallel corpus. See the full description on the dataset page: https://x/y"),
    ).toBe("A parallel corpus.");
  });

  it("does not leave empty brackets where a URL was stripped", () => {
    expect(summarize("Built from the Wikipedia dumps (https://dumps.wikimedia.org) monthly.")).toBe(
      "Built from the Wikipedia dumps monthly.",
    );
  });

  it("handles a card with no sentence punctuation", () => {
    expect(summarize("odia asr dataset")).toBe("odia asr dataset");
    expect(summarize("")).toBe("");
  });
});

describe("buildFacet", () => {
  const rows = [{ t: "a" }, { t: "b" }, { t: "a" }, { t: "" }];

  it("counts, drops blanks, and sorts by frequency", () => {
    expect(buildFacet(rows, (r) => r.t)).toEqual([
      { value: "a", label: "a", count: 2 },
      { value: "b", label: "b", count: 1 },
    ]);
  });

  it("applies the display label without changing the filter value", () => {
    const [first] = buildFacet(
      rows,
      (r) => r.t,
      (v) => v.toUpperCase(),
    );
    expect(first).toEqual({ value: "a", label: "A", count: 2 });
  });
});

describe("toggleValue", () => {
  it("adds, removes, and never mutates the input", () => {
    const start = new Set(["a"]);
    expect([...toggleValue(start, "b")]).toEqual(["a", "b"]);
    expect([...toggleValue(start, "a")]).toEqual([]);
    expect([...start]).toEqual(["a"]);
  });
});

describe("dataset size buckets", () => {
  it("sorts HF buckets smallest to largest", () => {
    const buckets = ["100B<n<1T", "n>1T", "n<1K", "1K<n<10K", "10M<n<100M"];
    expect([...buckets].sort((a, b) => sizeRank(a) - sizeRank(b))).toEqual([
      "n<1K",
      "1K<n<10K",
      "10M<n<100M",
      "100B<n<1T",
      "n>1T",
    ]);
  });

  it("spells out both comparisons", () => {
    expect(prettySize("10K<n<100K")).toBe("10K < n < 100K");
    expect(prettySize("n>1T")).toBe("n > 1T");
  });
});
