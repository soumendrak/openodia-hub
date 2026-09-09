import { afterEach, describe, expect, it, vi } from "vitest";

const textRouteHarness = vi.hoisted(() => ({
  catalog: vi.fn(),
  deadline: vi.fn(async (promise: Promise<unknown>) => promise),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("../src/lib/sources/catalog", () => ({ loadCatalog: textRouteHarness.catalog }));
vi.mock("../src/lib/fetch-utils", () => ({ withDeadline: textRouteHarness.deadline }));

type TextRoute = {
  options: { server: { handlers: { GET: () => Response | Promise<Response> } } };
};

const handler = (route: unknown) => (route as TextRoute).options.server.handlers.GET;

describe("machine-readable text routes", () => {
  afterEach(() => vi.clearAllMocks());

  it("serves the concise and comprehensive LLM discovery documents", async () => {
    const concise = await import("../src/routes/llms.txt");
    const full = await import("../src/routes/llms-full.txt");

    const conciseResponse = await handler(concise.Route)();
    expect(conciseResponse.headers.get("content-type")).toContain("text/plain");
    await expect(conciseResponse.text()).resolves.toContain("## APIs");

    const fullResponse = await handler(full.Route)();
    const body = await fullResponse.text();
    expect(body).toContain("# OpenOdia — Open source for the Odia language");
    expect(body).toContain(
      "========================================================================",
    );
    expect(body).toContain("# License");
  });

  it("serves static and deduplicated resource sitemap entries", async () => {
    const sitemap = await import("../src/routes/sitemap.xml");
    textRouteHarness.catalog.mockResolvedValueOnce([
      { permalink: "/r/model/a&b", updatedAt: "2026-09-03T10:00:00Z" },
      { permalink: "/r/model/a&b", updatedAt: "2026-09-04T10:00:00Z" },
      { permalink: "/r/dataset/c<d", createdAt: "invalid" },
      { permalink: "" },
    ]);

    const response = await handler(sitemap.Route)();
    const body = await response.text();
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(body).toContain("https://openodia.com/events");
    expect(body).toContain("a&amp;b");
    expect(body).toContain("c&lt;d");
    expect(body.match(/a&amp;b/g)).toHaveLength(1);
    expect(body).toContain("<lastmod>2026-09-03</lastmod>");
  });

  it("falls back to a short-lived static sitemap when catalog loading misses its deadline", async () => {
    const sitemap = await import("../src/routes/sitemap.xml");
    textRouteHarness.catalog.mockResolvedValueOnce([]);
    textRouteHarness.deadline.mockResolvedValueOnce([]);
    const response = await handler(sitemap.Route)();
    expect(response.headers.get("cache-control")).toBe("public, max-age=120");
    expect(await response.text()).not.toContain("/r/");
  });
});
