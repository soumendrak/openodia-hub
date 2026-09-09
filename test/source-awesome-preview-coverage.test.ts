import { afterEach, describe, expect, it, vi } from "vitest";

const sourceHarness = vi.hoisted(() => ({ fetchWithTimeout: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: sourceHarness.fetchWithTimeout }));
vi.mock("../src/lib/sources/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/sources/cache")>()),
  cachedJson: (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
}));

describe("Awesome README source", () => {
  afterEach(() => vi.clearAllMocks());

  it("parses HTML links, prefix names, defaults, and rejects unusable rows", async () => {
    const { parseReadme } = await import("../src/lib/sources/awesome");
    const long = "x".repeat(300);
    const items = parseReadme(`
# Title
## Models
### Speech
* <a class="x" href="https://example.com/html"><b>HTML Tool</b></a> : description [paper](https://paper)
- Prefix Tool: useful resource [code](https://example.com/code)
- No colon [fallback](https://example.com/fallback)
- [No description](https://example.com/empty)
- [Long](https://example.com/long): ${long}
- [Permalink](https://example.com/skip): skip
- [Relative](/relative): skip
- not a link
`);
    expect(items.map((item) => item.name)).toEqual([
      "HTML Tool",
      "Prefix Tool",
      "No colon",
      "No description",
      "Long",
    ]);
    expect(items.find((item) => item.name === "No description")?.description).toBe(
      "Models · Speech",
    );
    expect(items.find((item) => item.name === "Long")?.description).toHaveLength(278);
  });

  it("resolves the name/description split when the row has no colon or leads with one", async () => {
    const { parseReadme } = await import("../src/lib/sources/awesome");
    const items = parseReadme(`
## Tools
- Bare name [Text](x.com)
- : [Colon lead](https://example.com/colon-lead)
- [***](https://example.com/blank-name): description
`);
    // "Bare name [Text](x.com)" has no colon anywhere in the row (the link
    // target lacks "://"), exercising the no-colon branch of the separator
    // search; the url is then rejected for not being http(s), so it never
    // reaches the output.
    expect(items.find((item) => item.url === "x.com")).toBeUndefined();

    // A row that leads with ":" puts the separator at index 0, taking the
    // sepIdx <= 0 fallback that names the row from the link text instead.
    expect(items.find((item) => item.name === "Colon lead")).toMatchObject({
      url: "https://example.com/colon-lead",
      description: ":",
    });

    // A link whose text is pure markdown emphasis strips down to an empty
    // name and is dropped.
    expect(items.find((item) => item.url === "https://example.com/blank-name")).toBeUndefined();
  });

  it("loads a populated README and rejects failed or empty upstream responses", async () => {
    const { loadAwesome } = await import("../src/lib/sources/awesome");
    sourceHarness.fetchWithTimeout.mockResolvedValueOnce(
      new Response("## Tools\n- [One](https://example.com): Useful", { status: 200 }),
    );
    await expect(loadAwesome()).resolves.toMatchObject([{ name: "One" }]);
    sourceHarness.fetchWithTimeout.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await expect(loadAwesome()).rejects.toThrow("awesome_readme_503");
    sourceHarness.fetchWithTimeout.mockResolvedValueOnce(new Response("# Empty", { status: 200 }));
    await expect(loadAwesome()).rejects.toThrow("awesome_readme_empty");
  });
});

describe("dataset preview source", () => {
  it("returns viewer reasons for unavailable split and row responses", async () => {
    const { loadDatasetPreview } = await import("../src/lib/sources/preview");
    sourceHarness.fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "gated" }), { status: 403 }),
    );
    await expect(loadDatasetPreview("org/gated")).resolves.toEqual({
      available: false,
      reason: "gated",
    });

    sourceHarness.fetchWithTimeout.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    await expect(loadDatasetPreview("org/missing")).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining("no preview"),
    });

    sourceHarness.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            splits: [
              { config: "english", split: "test" },
              { config: "2026.odia", split: "test" },
              { config: "2026.odia", split: "train" },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "no rows" }), { status: 404 }));
    await expect(loadDatasetPreview("org/data id")).resolves.toEqual({
      available: false,
      reason: "no rows",
    });
    expect(sourceHarness.fetchWithTimeout.mock.calls.at(-1)?.[0]).toContain(
      "config=2026.odia&split=train",
    );
  });

  it("falls back to the default no-rows reason when the first-rows body isn't JSON", async () => {
    const { loadDatasetPreview } = await import("../src/lib/sources/preview");
    sourceHarness.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ splits: [{ config: "default", split: "train" }] })),
      )
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    await expect(loadDatasetPreview("org/bad-rows-json")).resolves.toEqual({
      available: false,
      reason: "The dataset viewer returned no rows.",
    });
  });

  it("defaults to no columns when the first-rows response omits features", async () => {
    const { loadDatasetPreview } = await import("../src/lib/sources/preview");
    sourceHarness.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ splits: [{ config: "default", split: "train" }] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [{ row: { text: "hello" } }] })));
    await expect(loadDatasetPreview("org/no-features")).resolves.toMatchObject({
      available: true,
      columns: [],
      rows: [[]],
    });
  });

  it("normalizes preview cells, columns, and row limits", async () => {
    const { loadDatasetPreview } = await import("../src/lib/sources/preview");
    sourceHarness.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ splits: [{ config: "default", split: "validation" }] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            features: [{ name: "text" }, { name: "meta" }, { name: "empty" }],
            rows: Array.from({ length: 7 }, (_, index) => ({
              row: {
                text: index === 0 ? "x".repeat(350) : `row ${index}`,
                meta: { index },
                empty: null,
              },
            })),
          }),
        ),
      );
    const preview = await loadDatasetPreview("org/data");
    expect(preview).toMatchObject({
      available: true,
      config: "default",
      split: "validation",
      columns: ["text", "meta", "empty"],
    });
    if (preview.available) {
      expect(preview.rows).toHaveLength(5);
      expect(preview.rows[0]?.[0]).toHaveLength(300);
      expect(preview.rows[0]?.[1]).toBe('{"index":0}');
      expect(preview.rows[0]?.[2]).toBe("");
    }
  });
});
