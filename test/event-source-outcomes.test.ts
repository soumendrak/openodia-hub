import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChapterOutcome, fetchLiveEventCollection, Route } from "../src/routes/api/events";

function page(results: unknown[] = []) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: { results, count: results.length, links: { next: null } },
          pastEvents: { results: [], count: 0, links: { next: null } },
        },
      },
    },
  })}</script>`;
}
const event = {
  title: "Healthy event",
  url: "https://example.org/event",
  start_date: "2099-01-01T10:00:00Z",
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("measured event outcomes", () => {
  it.each([
    [[], "success-empty", 0],
    [[event], "success-events", 1],
  ] as const)("distinguishes %s", async (records, outcome, count) => {
    globalThis.fetch = vi.fn(async () => new Response(page([...records])));
    const result = await fetchChapterOutcome("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(result.status).toMatchObject({
      sourceId: "gdg-bhubaneswar",
      outcome,
      eventCount: count,
      upcomingComplete: true,
      pastComplete: true,
    });
    expect(result.status.lastAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Date.parse(result.status.lastSuccessAt!)).toBeGreaterThanOrEqual(
      Date.parse(result.status.lastAttemptAt),
    );
    expect(result.events).toHaveLength(count);
  });
  it.each([
    ["HTTP", () => Promise.resolve(new Response("secret credential", { status: 503 })), "http"],
    [
      "JSON",
      () =>
        Promise.resolve(
          new Response('<script id="__NEXT_DATA__" type="application/json">{ broken</script>'),
        ),
      "parse",
    ],
    ["shape", () => Promise.resolve(new Response("<html>changed page</html>")), "parse"],
    ["network", () => Promise.reject(new TypeError("secret network details")), "network"],
    ["abort", () => Promise.reject(new DOMException("secret", "AbortError")), "timeout"],
  ] as const)("sanitizes %s failures", async (_, fetcher, category) => {
    globalThis.fetch = vi.fn(fetcher) as typeof fetch;
    const result = await fetchChapterOutcome("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(result.status).toMatchObject({
      outcome: "failed",
      errorCategory: category,
      eventCount: 0,
    });
    expect(result.status.lastSuccessAt).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it.each([null, { ...event, start_date: "invalid" }, { ...event, event_type_title: 8 }])(
    "treats malformed event records as parse failures",
    async (record) => {
      globalThis.fetch = vi.fn(async () => new Response(page([record])));
      expect((await fetchChapterOutcome("Community", "chapter")).status.errorCategory).toBe(
        "parse",
      );
    },
  );
  it("bounds a stalled body as well as the headers", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: () => new Promise(() => {}),
    })) as typeof fetch;
    const result = await fetchChapterOutcome("GDG Bhubaneswar", "gdg-bhubaneswar", 5);
    expect(result.status.errorCategory).toBe("timeout");
  });
  it("reports mixed and total failures honestly", async () => {
    globalThis.fetch = vi.fn(async (input) =>
      String(input).includes("/gdg-bhubaneswar/")
        ? new Response(page([event]))
        : new Response("offline", { status: 503 }),
    );
    const mixed = await fetchLiveEventCollection();
    expect(mixed.events.map((event) => event.title)).toEqual(["Healthy event"]);
    expect(mixed.partial).toBe(true);
    expect(mixed.sources.filter((source) => source.outcome === "failed")).toHaveLength(4);
    globalThis.fetch = vi.fn(async () => new Response("offline", { status: 503 }));
    const failed = await fetchLiveEventCollection();
    expect(failed.events).toEqual([]);
    expect(failed.partial).toBe(true);
    expect(failed.sources.every((source) => source.outcome === "failed")).toBe(true);
  });
  it("API returns healthy and retained events with bounded partial metadata on mixed and total live failures", async () => {
    const get = (
      Route.options as unknown as {
        server: { handlers: { GET: (args: { request: Request }) => Promise<Response> } };
      }
    ).server.handlers.GET;
    globalThis.fetch = vi.fn(async (input) =>
      String(input).includes("/gdg-bhubaneswar/")
        ? new Response(page([event]))
        : new Response("secret", { status: 503 }),
    );
    const response = await get({ request: new Request("https://openodia.com/api/events") });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(data.partial).toBe(true);
    expect(data.events.some((item: { title: string }) => item.title === "Healthy event")).toBe(
      true,
    );
    expect(data.sources).toHaveLength(5);
    expect(
      data.sources.filter((source: { outcome: string }) => source.outcome === "failed"),
    ).toHaveLength(4);
    expect(JSON.stringify(data.sources)).not.toContain("secret");
    globalThis.fetch = vi.fn(async () => new Response("secret", { status: 503 }));
    const failed = await get({
      request: new Request("https://openodia.com/api/events?page=-1&limit=-5"),
    });
    const fallback = await failed.json();
    expect(failed.status).toBe(200);
    expect(fallback.partial).toBe(true);
    expect(fallback.events).toHaveLength(1);
    expect(
      fallback.sources.every((source: { outcome: string }) => source.outcome === "failed"),
    ).toBe(true);
  });
});
