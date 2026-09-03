import { describe, it, expect } from "vitest";
import { refFromUrl, refFromSplat, refToPath, upstreamUrl } from "../src/lib/resource-id";
import { queryCatalog, type CatalogEntry } from "../src/lib/sources/catalog";

describe("refFromUrl", () => {
  it("identifies GitHub repos", () => {
    expect(refFromUrl("https://github.com/OdiaGenAI/Olive_Odia_ASR")).toEqual({
      kind: "gh",
      id: "OdiaGenAI/Olive_Odia_ASR",
    });
    expect(refFromUrl("https://github.com/OdiaNLP/NMT.git")).toEqual({
      kind: "gh",
      id: "OdiaNLP/NMT",
    });
  });

  it("separates Hugging Face models from datasets", () => {
    expect(refFromUrl("https://huggingface.co/ai4bharat/IndicNER")).toEqual({
      kind: "model",
      id: "ai4bharat/IndicNER",
    });
    expect(refFromUrl("https://huggingface.co/datasets/wikimedia/wikipedia")).toEqual({
      kind: "dataset",
      id: "wikimedia/wikipedia",
    });
  });

  it("returns nothing for URLs that are not a resource", () => {
    // Deeper GitHub paths are a file or an issue, not the repo.
    expect(refFromUrl("https://github.com/OdiaNLP/NMT/issues/3")).toBeNull();
    expect(refFromUrl("https://huggingface.co/spaces/someone/demo")).toBeNull();
    expect(refFromUrl("https://arxiv.org/abs/2104.05596")).toBeNull();
    expect(refFromUrl("https://ai4bharat.iitm.ac.in/areas/xlit")).toBeNull();
    expect(refFromUrl("not a url")).toBeNull();
  });

  it("returns nothing for a known host with no path at all", () => {
    expect(refFromUrl("https://github.com/")).toBeNull();
  });

  it("rejects a dataset URL with too few or too many segments", () => {
    expect(refFromUrl("https://huggingface.co/datasets")).toBeNull();
    expect(refFromUrl("https://huggingface.co/datasets/a/b/c")).toBeNull();
  });

  it("rejects a model URL with more than two path segments", () => {
    expect(refFromUrl("https://huggingface.co/a/b/c")).toBeNull();
  });

  it("round-trips through the permalink path", () => {
    for (const url of [
      "https://github.com/OdiaNLP/NMT",
      "https://huggingface.co/ai4bharat/IndicNER",
      "https://huggingface.co/datasets/wikimedia/wikipedia",
    ]) {
      const ref = refFromUrl(url)!;
      expect(refFromSplat(refToPath(ref).replace("/r/", ""))).toEqual(ref);
      expect(upstreamUrl(ref)).toBe(url);
    }
  });
});

describe("refFromSplat", () => {
  it("rejects unknown kinds and malformed ids", () => {
    expect(refFromSplat("space/foo/bar")).toBeNull();
    expect(refFromSplat("gh")).toBeNull();
    expect(refFromSplat("gh/a/b/c")).toBeNull();
  });
});

describe("queryCatalog", () => {
  const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
    key: "k",
    kind: "gh",
    name: "n",
    author: "a",
    url: "u",
    description: "",
    license: "",
    task: "",
    tags: [],
    sources: [],
    ...over,
  });

  const entries = [
    entry({ key: "1", kind: "model", author: "OdiaGenAI", license: "Apache-2.0", name: "asr" }),
    entry({ key: "2", kind: "dataset", author: "ai4bharat", license: "MIT", name: "corpus" }),
    entry({ key: "3", kind: "gh", author: "OdiaNLP", license: "MIT", tags: ["translation"] }),
  ];

  it("filters by kind, license, and author", () => {
    expect(queryCatalog(entries, { kind: "model", limit: 10, offset: 0 }).total).toBe(1);
    expect(queryCatalog(entries, { license: "mit", limit: 10, offset: 0 }).total).toBe(2);
    expect(queryCatalog(entries, { author: "odianlp", limit: 10, offset: 0 }).total).toBe(1);
  });

  it("free-text matches name and tags", () => {
    expect(queryCatalog(entries, { q: "corpus", limit: 10, offset: 0 }).total).toBe(1);
    expect(queryCatalog(entries, { q: "translation", limit: 10, offset: 0 }).total).toBe(1);
  });

  it("paginates without changing the reported total", () => {
    const page = queryCatalog(entries, { limit: 2, offset: 2 });
    expect(page.total).toBe(3);
    expect(page.resources).toHaveLength(1);
    expect(page.resources[0].key).toBe("3");
  });
});
