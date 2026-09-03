import { afterEach, describe, expect, it, vi } from "vitest";

const paperHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: paperHarness.fetch }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  UpstreamUnavailableError: class UpstreamUnavailableError extends Error {},
}));

import { loadPapers } from "../src/lib/sources/papers";

afterEach(() => {
  paperHarness.fetch.mockReset();
  vi.restoreAllMocks();
});

describe("research-paper source adapter", () => {
  it("parses and merges OpenAlex and arXiv records", async () => {
    paperHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("openalex.org") && url.includes("page=1")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: "https://openalex.org/W1",
                  doi: "https://doi.org/10.1234/odia",
                  title: "Odia machine translation",
                  publication_year: 2025,
                  abstract_inverted_index: { Translation: [0], corpus: [1] },
                  authorships: [{ author: { display_name: "A" } }, { author: {} }],
                  primary_location: {
                    source: { display_name: "ACL" },
                    landing_page_url: "https://example.com/paper",
                  },
                  open_access: { is_oa: true, oa_url: "https://example.com/paper.pdf" },
                },
                { id: "empty-title", title: " " },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("openalex.org")) {
        return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(
          `<feed><entry><id>https://arxiv.org/abs/1</id><title>Odia machine translation</title><summary>A longer translation corpus abstract.</summary><published>2026-01-02</published><author><name>A</name></author><author><name>B</name></author><link title="pdf" href="https://arxiv.org/pdf/1" /></entry><entry><id>ignored</id><title> </title></entry></feed>`,
          { status: 200 },
        ),
      );
    });

    const papers = await loadPapers();
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      venue: "ACL",
      openAccess: true,
      year: 2025,
      authors: ["A", "B"],
    });
    expect(papers[0].tasks).toContain("Translation");
    expect(papers[0].sources).toEqual(expect.arrayContaining(["openalex", "arxiv"]));
  });

  it("uses display names and landing pages when optional OpenAlex fields are absent", async () => {
    paperHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("openalex.org") && url.includes("page=1")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: "W2",
                  display_name: "Odia OCR dataset",
                  primary_location: { landing_page_url: "https://example.com/w2" },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes("openalex.org")) {
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }
      return Promise.resolve(new Response("<feed />", { status: 200 }));
    });
    expect(await loadPapers()).toEqual([
      expect.objectContaining({
        title: "Odia OCR dataset",
        year: null,
        url: "https://example.com/w2",
        openAccess: false,
      }),
    ]);
  });

  it("stops OpenAlex pagination on an empty page and falls back for works missing every optional field", async () => {
    let openalexCalls = 0;
    paperHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("openalex.org")) {
        openalexCalls += 1;
        if (openalexCalls === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                results: [
                  // No title and no display_name: filtered out before it can be used.
                  { id: "https://openalex.org/W3", publication_year: 2020 },
                  // No doi and no primary_location: url must fall back to the work id.
                  { id: "https://openalex.org/W4", title: "Odia dataset", publication_year: 2021 },
                ],
              }),
              { status: 200 },
            ),
          );
        }
        // Second page carries no `results` key at all, so the loop must stop here.
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }
      return Promise.resolve(new Response("<feed />", { status: 200 }));
    });

    const papers = await loadPapers();
    expect(openalexCalls).toBe(2);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({ title: "Odia dataset", url: "https://openalex.org/W4" });
  });

  it("keeps one source when the other fails and rejects when both fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    paperHarness.fetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("openalex.org")
          ? new Response("no", { status: 500 })
          : new Response(
              "<entry><id>arxiv:1</id><title>Odia corpus</title><summary>Dataset.</summary></entry>",
              { status: 200 },
            ),
      ),
    );
    expect(await loadPapers()).toHaveLength(1);

    paperHarness.fetch.mockResolvedValue(new Response("no", { status: 503 }));
    await expect(loadPapers()).rejects.toThrow("no_paper_source_available");
  });
});
