// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../src/data/events/types";
const fixture = vi.hoisted(() => ({ events: [] as Event[] }));
vi.mock("../src/data/events", () => ({
  get events() {
    return fixture.events;
  },
}));
const emptyChapter = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: { upcomingEvents: { results: [] }, pastEvents: { results: [] } } } } })}</script>`;
const get = (route: unknown) =>
  (
    route as {
      options: { server: { handlers: { GET: (args: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.GET;
afterEach(() => {
  fixture.events = [];
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("P1 lifecycle request regressions", () => {
  it.each(["upcomingEvents", "pastEvents"])(
    "rejects malformed %s without claiming an empty success",
    async (malformed) => {
      const collections = {
        upcomingEvents: { results: [] },
        pastEvents: { results: [] },
        [malformed]: { results: null },
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: collections } } })}</script>`,
            ),
        ),
      );
      const { fetchChapterOutcome } = await import("../src/routes/api/events");
      expect((await fetchChapterOutcome("GDG Bhubaneswar", "gdg-bhubaneswar")).status.outcome).toBe(
        "failed",
      );
    },
  );
  it("retains a failure when the chapter response body exceeds its deadline", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        signal = init?.signal;
        return { ok: true, text: () => new Promise<string>(() => {}) };
      }),
    );
    const { fetchChapterOutcome } = await import("../src/routes/api/events");
    expect(
      (await fetchChapterOutcome("GDG Bhubaneswar", "gdg-bhubaneswar", 5)).status.outcome,
    ).toBe("failed");
    expect(signal?.aborted).toBe(true);
  });
  it("performs zero redirect HEAD requests for 114 archived GDG URLs in multiple cold isolates", async () => {
    fixture.events = Array.from({ length: 114 }, (_, index) => ({
      url: `https://gdg.community.dev/events/details/archive-${index}`,
      title: `Archive ${index}`,
      type: "Talk",
      community: "GDG Bhubaneswar",
      year: "2026",
      date: "2026-01-01",
      startDate: "2026-01-01",
    }));
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    for (let isolate = 0; isolate < 2; isolate++) {
      vi.resetModules();
      const { loadReviewedEventCollection } = await import("../src/lib/sources/events");
      expect((await loadReviewedEventCollection(false)).events).toHaveLength(114);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["http", "network", "parse"])(
    "reports a failed live chapter as partial on API, RSS and search (%s)",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          if (String(input).includes("gdg-bhubaneswar/")) {
            if (kind === "network") throw new TypeError("offline");
            return new Response(kind === "parse" ? "missing state" : "offline", {
              status: kind === "http" ? 503 : 200,
            });
          }
          return new Response(emptyChapter);
        }),
      );
      const { Route: ApiRoute } = await import("../src/routes/api/events");
      const api = await get(ApiRoute)({ request: new Request("https://openodia.com/api/events") });
      expect((await api.json()).partial).toBe(true);
      expect(api.headers.get("Cache-Control")).toBe("no-store");
      const { Route: FeedRoute } = await import("../src/routes/events-feed");
      const feed = await get(FeedRoute)({
        request: new Request("https://openodia.com/events-feed"),
      });
      expect(feed.headers.get("Cache-Control")).toBe("no-store");
      const { buildSearchSnapshot, loadLiveSearchEvents } =
        await import("../src/lib/sources/search");
      const snapshot = await buildSearchSnapshot({
        catalog: async () => [],
        papers: async () => [],
        videos: async () => [],
        events: loadLiveSearchEvents,
      });
      expect(snapshot.sources.find((source) => source.source === "events")?.status).toBe("partial");
    },
  );
});
