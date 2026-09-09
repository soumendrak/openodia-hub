import { afterEach, describe, expect, it, vi } from "vitest";

const hfHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: hfHarness.fetch }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  UpstreamUnavailableError: class UpstreamUnavailableError extends Error {},
}));

import { loadDatasets, loadModels, summarize } from "../src/lib/sources/huggingface";

afterEach(() => {
  hfHarness.fetch.mockReset();
  vi.restoreAllMocks();
});

describe("Hugging Face source adapter", () => {
  it("paginates and normalizes model defaults and metadata", async () => {
    hfHarness.fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "openodia/model",
              pipeline_tag: "text-classification",
              library_name: "transformers",
              downloads: 10,
              likes: 2,
              tags: ["license:apache-2.0"],
              createdAt: "2026-01-01",
            },
          ]),
          { status: 200, headers: { link: '<https://example.com/page-2>; rel="next"' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "single", tags: [] }]), { status: 200 }),
      );

    await expect(loadModels()).resolves.toEqual({
      truncated: false,
      items: [
        {
          id: "openodia/model",
          author: "openodia",
          name: "model",
          url: "https://huggingface.co/openodia/model",
          task: "text-classification",
          library: "transformers",
          license: "apache-2.0",
          downloads: 10,
          likes: 2,
          tags: ["license:apache-2.0"],
          createdAt: "2026-01-01",
        },
        {
          id: "single",
          author: "single",
          name: "single",
          url: "https://huggingface.co/single",
          task: "other",
          library: "",
          license: "",
          downloads: 0,
          likes: 0,
          tags: [],
          createdAt: "",
        },
      ],
    });
  });

  it("normalizes dataset tags, description, and timestamps", async () => {
    hfHarness.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "openodia/data",
            description: "# Card\nUseful dataset. More detail.",
            downloads: 5,
            likes: 1,
            tags: [
              "task_categories:translation",
              "license:cc-by-4.0",
              "size_categories:10K<n<100K",
              "modality:text",
              "modality:audio",
            ],
            createdAt: "2025-01-01",
            lastModified: "2026-01-01",
          },
        ]),
        { status: 200 },
      ),
    );
    const page = await loadDatasets();
    expect(page.truncated).toBe(false);
    expect(page.items[0]).toMatchObject({
      author: "openodia",
      name: "data",
      task: "translation",
      license: "cc-by-4.0",
      sizeCategory: "10K<n<100K",
      modalities: ["text", "audio"],
      updatedAt: "2026-01-01",
    });
  });

  it("falls back defaults for a dataset missing optional fields", async () => {
    hfHarness.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "soloDataset" }]), { status: 200 }),
    );
    const page = await loadDatasets();
    expect(page.truncated).toBe(false);
    const item = page.items.find((d) => d.id === "soloDataset");
    expect(item).toEqual({
      id: "soloDataset",
      author: "soloDataset",
      name: "soloDataset",
      url: "https://huggingface.co/datasets/soloDataset",
      description: "",
      task: "other",
      license: "",
      sizeCategory: "",
      modalities: [],
      downloads: 0,
      likes: 0,
      tags: [],
      createdAt: "",
      updatedAt: undefined,
    });
  });

  it('stops pagination when the link header has no rel="next" match', async () => {
    hfHarness.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "org/only" }]), {
        status: 200,
        headers: { link: '<https://example.com/page-0>; rel="prev"' },
      }),
    );
    const result = await loadModels();
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it("throws on a failed page and marks an eight-page result truncated", async () => {
    hfHarness.fetch.mockResolvedValueOnce(new Response("no", { status: 429 }));
    await expect(loadModels()).rejects.toThrow("hf_models_429");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (let page = 0; page < 8; page += 1) {
      hfHarness.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: `org/model-${page}` }]), {
          status: 200,
          headers: { link: `<https://example.com/page-${page + 2}>; rel="next"` },
        }),
      );
    }
    const result = await loadModels();
    expect(result).toMatchObject({ truncated: true });
    expect(result.items).toHaveLength(8);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("stopped at 8 pages"));
  });

  it("truncates long summaries with and without sentence punctuation", () => {
    expect(summarize("x".repeat(300))).toHaveLength(218);
    expect(summarize(`${"Sentence. ".repeat(40)}`, 40)).toHaveLength(258);
  });
});
