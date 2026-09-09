import { describe, expect, it, vi } from "vitest";

const externalHarness = vi.hoisted(() => ({
  parseReadme: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("../src/lib/sources/awesome", () => ({ parseReadme: externalHarness.parseReadme }));
vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: externalHarness.fetchWithTimeout }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
}));

describe("external catalog loading", () => {
  it("filters pan-Indic rows and keeps successful catalogs when another fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { loadExternalCatalogs } = await import("../src/lib/sources/catalogs");
    externalHarness.parseReadme.mockImplementation((markdown: string) =>
      markdown.includes("indicnlp_catalog")
        ? [
            { name: "Odia corpus", description: "Resource", subcategory: "", url: "https://odia" },
            { name: "Hindi corpus", description: "Hindi", subcategory: "", url: "https://hindi" },
          ]
        : [{ name: "Any", description: "Resource", subcategory: "", url: "https://one" }],
    );
    externalHarness.fetchWithTimeout.mockImplementation(
      async (url: string) => new Response(url, { status: 200 }),
    );
    const loaded = await loadExternalCatalogs();
    expect(loaded[0]?.items).toHaveLength(1);
    expect(loaded[1]?.items.map((item) => item.name)).toEqual(["Odia corpus"]);

    externalHarness.fetchWithTimeout
      .mockResolvedValueOnce(new Response("bad", { status: 500 }))
      .mockResolvedValueOnce(new Response("readme", { status: 200 }));
    externalHarness.parseReadme.mockReturnValueOnce([]);
    await expect(loadExternalCatalogs()).resolves.toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });
});
