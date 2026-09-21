import { describe, expect, it } from "vitest";
import {
  normalizeSearch,
  scoreSearchDocument,
  searchDocuments,
  searchTokens,
  type SearchDocument,
} from "../src/lib/search";

const documents: SearchDocument[] = [
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `early:${index}`,
    kind: "tool" as const,
    title: `Generic resource ${index}`,
    summary: "A generic Odia language resource.",
    source: "fixture",
  })),
  {
    id: "late:exact",
    kind: "model",
    title: "Odia OCR Atlas",
    summary: "Optical character recognition model.",
    keywords: ["oriya", "vision"],
    source: "fixture",
  },
  {
    id: "description-only",
    kind: "tool",
    title: "Unrelated project",
    summary: "Includes an Odia OCR example in its long description.",
    source: "fixture",
  },
];

describe("search normalization and ranking", () => {
  it("normalizes common Odia language aliases without damaging Romanized terms", () => {
    expect(normalizeSearch("Oriya  OCR")).toBe("odia ocr");
    expect(normalizeSearch("ଓଡ଼ିଆ OCR")).toBe("odia ocr");
    expect(normalizeSearch("Odia NLP")).toBe("odia nlp");
    expect(normalizeSearch("  ଓଡ଼ିଆ—ଭାଷା  ")).toBe("odia ଭାଷା");
    expect(searchTokens("  Odia—OCR  ")).toEqual(["odia", "ocr"]);
  });

  it("uses curated keyword aliases for Romanized Odia without claiming transliteration", () => {
    const odiaDocument: SearchDocument = {
      id: "page:odia-language",
      kind: "page",
      title: "ଓଡ଼ିଆ ଭାଷା ଟୁଲକିଟ",
      summary: "ଓଡ଼ିଆ ଲେଖା ପାଇଁ ଉପକରଣ",
      keywords: ["odia bhasha", "odia bhasa", "language toolkit"],
      source: "fixture",
    };
    expect(searchDocuments([odiaDocument], "ଓଡ଼ିଆ ଭାଷା")[0]?.id).toBe(odiaDocument.id);
    expect(searchDocuments([odiaDocument], "odia bhasha")[0]?.id).toBe(odiaDocument.id);
    expect(searchDocuments([odiaDocument], "odia bhasa")[0]?.id).toBe(odiaDocument.id);
  });

  it("scores the complete corpus before applying a limit", () => {
    const results = searchDocuments(documents, "Odia OCR Atlas", { limit: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("late:exact");
  });

  it("ranks an exact title above a description-only match", () => {
    const results = searchDocuments(documents, "odia ocr");
    expect(results.map((result) => result.id).slice(0, 2)).toEqual([
      "late:exact",
      "description-only",
    ]);
  });

  it("deduplicates stable identities and rejects unrelated subsequences", () => {
    const duplicates: SearchDocument[] = [
      { ...documents[30], title: "Odia OCR Atlas", id: "same" },
      { ...documents[30], title: "Odia OCR Atlas", id: "same", summary: "A richer duplicate." },
    ];
    expect(searchDocuments(duplicates, "atlas")).toHaveLength(1);
    expect(searchDocuments(documents, "od ai")).toEqual([]);
  });

  it("uses deterministic ties, bounded typo tolerance, kind scopes, and post-score limits", () => {
    const fixtures: SearchDocument[] = [
      { id: "z", kind: "tool", title: "Odia Zebra", summary: "", source: "fixture" },
      { id: "a", kind: "model", title: "Odia Atlas", summary: "", source: "fixture" },
      { id: "b", kind: "dataset", title: "Odia Beacon", summary: "", source: "fixture" },
    ];
    expect(searchDocuments(fixtures, "odia").map((result) => result.id)).toEqual(["a", "b", "z"]);
    expect(searchDocuments(fixtures, "atlaa")[0]?.id).toBe("a");
    expect(searchDocuments(fixtures, "atx")).toEqual([]);
    expect(searchDocuments(fixtures, "odia", { kinds: ["dataset"], limit: 1 })).toEqual([
      expect.objectContaining({ id: "b" }),
    ]);
    expect(searchDocuments(fixtures, "odia", { perKindLimit: 1 })).toHaveLength(3);
    expect(
      searchDocuments(
        [
          ...fixtures,
          { id: "z2", kind: "tool", title: "Odia Zebu", summary: "", source: "fixture" },
        ],
        "odia",
        { perKindLimit: 1 },
      ).map((result) => result.kind),
    ).toEqual(["model", "dataset", "tool"]);
  });

  it("scores direct calls, empty queries, and non-contiguous complete token matches", () => {
    const document: SearchDocument = {
      id: "token-match",
      kind: "tool",
      title: "Odia community OCR atlas",
      summary: "",
      source: "fixture",
    };
    expect(scoreSearchDocument(document, "")).toBe(0);
    expect(scoreSearchDocument(document, "odia atlas")).toBeGreaterThan(0);
  });
});
