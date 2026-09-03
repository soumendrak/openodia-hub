import { afterEach, describe, expect, it, vi } from "vitest";

const catalogHarness = vi.hoisted(() => ({
  awesome: vi.fn(),
  external: vi.fn(),
  repos: vi.fn(),
  models: vi.fn(),
  datasets: vi.fn(),
  parseReadme: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("../src/lib/sources/awesome", () => ({
  loadAwesome: catalogHarness.awesome,
  parseReadme: catalogHarness.parseReadme,
}));
vi.mock("../src/lib/sources/catalogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/sources/catalogs")>()),
  loadExternalCatalogs: catalogHarness.external,
}));
vi.mock("../src/lib/sources/repos", () => ({ loadRepos: catalogHarness.repos }));
vi.mock("../src/lib/sources/huggingface", () => ({
  loadModels: catalogHarness.models,
  loadDatasets: catalogHarness.datasets,
}));
vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: catalogHarness.fetchWithTimeout }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
}));

describe("unified resource catalog", () => {
  afterEach(() => vi.clearAllMocks());

  it("merges overlapping sources while retaining curated prose and live metadata", async () => {
    const { loadCatalog } = await import("../src/lib/sources/catalog");
    catalogHarness.awesome.mockResolvedValue([
      {
        name: "Curated repo",
        url: "https://github.com/org/repo",
        description: "MIT licensed curated prose",
        category: "Tools",
        subcategory: "NLP",
      },
      {
        name: "Link",
        url: "https://example.com/link",
        description: "External",
        category: "Reading",
      },
    ]);
    catalogHarness.external.mockResolvedValue([
      {
        catalog: { id: "other" },
        items: [
          {
            name: "Other listing",
            url: "https://github.com/org/repo",
            description: "Other prose",
            category: "Catalog",
          },
        ],
      },
    ]);
    catalogHarness.repos.mockResolvedValue([
      {
        full_name: "org/repo",
        name: "repo",
        html_url: "https://github.com/org/repo",
        description: "Generated repo prose",
        license: { spdx_id: "MIT" },
        language: "TypeScript",
        stargazers_count: 10,
        topics: ["odia"],
        created_at: "2025-01-01",
        updated_at: "2026-01-01",
      },
    ]);
    catalogHarness.models.mockResolvedValue({
      items: [
        {
          id: "org/model",
          name: "model",
          author: "org",
          url: "https://huggingface.co/org/model",
          license: "apache-2.0",
          task: "text",
          downloads: 2,
          likes: 1,
          tags: ["odia"],
          createdAt: "2025-01-01",
        },
      ],
    });
    catalogHarness.datasets.mockResolvedValue({
      items: [
        {
          id: "org/data",
          name: "data",
          author: "org",
          url: "https://huggingface.co/datasets/org/data",
          description: "Data",
          license: "cc-by-4.0",
          task: "translation",
          sizeCategory: "1K<n<10K",
          downloads: 3,
          likes: 2,
          tags: ["odia"],
          createdAt: "2025-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });

    const catalog = await loadCatalog();
    const repo = catalog.find((entry) => entry.kind === "gh")!;
    expect(repo.description).toBe("MIT licensed curated prose");
    expect(repo.sources).toEqual(["awesome-odia-ai", "other", "github"]);
    expect(repo.stars).toBe(10);
    expect(catalog.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(["link", "model", "dataset"]),
    );
  });

  it("falls back to next.description when base.description is empty, and covers null-ref and missing-field fallbacks", async () => {
    const { loadCatalog } = await import("../src/lib/sources/catalog");
    catalogHarness.awesome.mockResolvedValue([
      { name: "X", url: "https://github.com/org/x", description: "", category: "Tools" },
    ]);
    catalogHarness.external.mockResolvedValue([
      {
        catalog: { id: "other" },
        items: [
          {
            name: "Blog post",
            url: "https://example.com/blog/post",
            description: "An article",
            category: "Reading",
          },
        ],
      },
    ]);
    catalogHarness.repos.mockResolvedValue([
      {
        full_name: "org/x",
        name: "x",
        html_url: "https://github.com/org/x",
        description: "Full repo description",
        license: {},
        language: "TS",
        stargazers_count: 1,
        topics: [],
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
      {
        full_name: "org/bare",
        name: "bare",
        html_url: "https://github.com/org/bare",
        stargazers_count: 0,
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
    ]);
    catalogHarness.models.mockResolvedValue({ items: [] });
    catalogHarness.datasets.mockResolvedValue({ items: [] });

    const catalog = await loadCatalog();

    const merged = catalog.find((entry) => entry.url === "https://github.com/org/x")!;
    expect(merged.description).toBe("Full repo description");

    const link = catalog.find((entry) => entry.key === "https://example.com/blog/post")!;
    expect(link.kind).toBe("link");
    expect(link.author).toBe("");
    expect(link.permalink).toBeUndefined();

    const bare = catalog.find((entry) => entry.url === "https://github.com/org/bare")!;
    expect(bare.description).toBe("");
    expect(bare.language).toBeUndefined();
    expect(bare.tags).toEqual([]);
  });

  it("survives individual upstream failures and rejects an entirely empty catalog", async () => {
    const { loadCatalog } = await import("../src/lib/sources/catalog");
    catalogHarness.awesome.mockRejectedValue(new Error("down"));
    catalogHarness.external.mockRejectedValue(new Error("down"));
    catalogHarness.repos.mockRejectedValue(new Error("down"));
    catalogHarness.models.mockRejectedValue(new Error("down"));
    catalogHarness.datasets.mockResolvedValue({
      items: [
        {
          id: "org/data",
          name: "data",
          author: "org",
          url: "https://huggingface.co/datasets/org/data",
          description: "",
          license: "",
          task: "",
          downloads: 0,
          likes: 0,
          tags: [],
        },
      ],
    });
    await expect(loadCatalog()).resolves.toHaveLength(1);

    catalogHarness.datasets.mockRejectedValue(new Error("down"));
    await expect(loadCatalog()).rejects.toThrow("every catalog source failed");
  });

  it("filters catalog queries across exact facets and free text with pagination", async () => {
    const { queryCatalog } = await import("../src/lib/sources/catalog");
    const entries = [
      {
        key: "one",
        kind: "model",
        name: "Odia model",
        author: "Alice",
        url: "",
        description: "Speech",
        license: "MIT",
        task: "ASR",
        tags: ["audio"],
        sources: [],
      },
      {
        key: "two",
        kind: "dataset",
        name: "Corpus",
        author: "Bob",
        url: "",
        description: "Text",
        license: "CC0",
        task: "translation",
        tags: ["odia"],
        sources: [],
      },
    ] as never[];
    expect(
      queryCatalog(entries, {
        kind: "model",
        license: "mit",
        author: "alice",
        q: "audio",
        limit: 1,
        offset: 0,
      }).total,
    ).toBe(1);
    expect(queryCatalog(entries, { q: "translation", limit: 1, offset: 0 }).resources[0]?.key).toBe(
      "two",
    );
    expect(queryCatalog(entries, { q: "missing", limit: 10, offset: 0 }).total).toBe(0);
    expect(queryCatalog(entries, { limit: 1, offset: 1 })).toMatchObject({
      total: 2,
      offset: 1,
      limit: 1,
    });
  });
});
