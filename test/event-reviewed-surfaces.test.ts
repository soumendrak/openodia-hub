// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { persistReviewedEvent } from "../src/lib/event-reviewed-store";
import { withEventDatabase } from "../src/lib/event-request-context";
import { applyEventOverrides } from "../src/lib/event-lifecycle";
import { loadReviewedEventCollection } from "../src/lib/sources/events";
import { Route as ApiRoute } from "../src/routes/api/events";
import { Route as FeedRoute } from "../src/routes/events-feed";
import {
  buildSearchSnapshot,
  createSearchSnapshotLoader,
  loadLiveSearchEvents,
} from "../src/lib/sources/search";
import type { D1Like } from "../src/lib/events-store";
import type { Event } from "../src/data/events/types";
const fixture = vi.hoisted(() => ({ events: [] as Event[] }));
vi.mock("../src/data/events", () => ({
  get events() {
    return fixture.events;
  },
}));
const proof = { evidenceUrl: "https://example.org/official", verifiedAt: "2026-10-12" };
const event: Event = {
  url: "https://example.org/workshop",
  title: "Reviewed workshop",
  description: "Fixture",
  type: "Workshop",
  community: "GDG Bhubaneswar",
  year: "2099",
  date: "2099-01-10",
  startDate: "2099-01-10",
};
let mf: Miniflare;
let db: D1Like;
const originalFetch = globalThis.fetch;
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch:()=>new Response('')}",
    d1Databases: ["EVENTS_DB"],
  });
  db = await mf.getD1Database("EVENTS_DB");
  for (const sql of readFileSync("db/schema.sql", "utf8")
    .split(";")
    .filter((s) => s.trim()))
    await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT INTO events(id,url,title,community,type,start_date,description) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      event.url,
      event.url,
      event.title,
      event.community,
      event.type,
      event.startDate,
      event.description,
    )
    .run();
  const reviewed = applyEventOverrides(event, [
    {
      url: event.url,
      evidenceUrl: proof.evidenceUrl,
      reviewedAt: "2026-10-12",
      patch: {
        lifecycle: { state: "cancelled", ...proof },
        registration: { state: "closed", ...proof },
        attendance: { policy: "restricted", note: "Members only" },
        notices: [{ kind: "cancellation", text: "Organizer cancelled the event", ...proof }],
      },
    },
  ]);
  await persistReviewedEvent(db, reviewed);
});
afterAll(() => mf.dispose());
afterEach(() => {
  globalThis.fetch = originalFetch;
  fixture.events = [];
  vi.restoreAllMocks();
});
const get = (route: unknown) =>
  (
    route as {
      options: { server: { handlers: { GET: (args: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.GET;
const emptyLoaders = {
  catalog: async () => [],
  papers: async () => [],
  videos: async () => [],
  events: loadLiveSearchEvents,
};

describe("the same persisted review reaches every server surface", () => {
  it("restores cancellation/registration through TanStack API, RSS and search without unreviewed live overwrite", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("no upstream requests expected");
    });
    await withEventDatabase(db, async () => {
      const api = await get(ApiRoute)({ request: new Request("https://openodia.com/api/events") });
      const body = await api.json();
      expect(body.events).toHaveLength(1);
      expect(body.events[0]).toMatchObject({
        lifecycle: { state: "cancelled" },
        registration: { state: "closed" },
        attendance: { policy: "restricted" },
      });
      expect(body.events[0].status).toBeUndefined();
      const rss = await get(FeedRoute)({
        request: new Request("https://openodia.com/events-feed"),
      });
      const text = await rss.text();
      expect(text).toContain("Cancelled");
      expect(text).toContain("Registration closed");
      expect(text).toContain("Organizer cancelled the event");
      const snapshot = await buildSearchSnapshot(emptyLoaders);
      expect(snapshot.documents.find((doc) => doc.kind === "event")?.summary).toContain(
        "Cancelled",
      );
      expect(snapshot.documents.find((doc) => doc.kind === "event")?.summary).toContain(
        "Registration closed",
      );
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("resolves a stale redirect on every surface even when reviewed replacement dates differ", async () => {
    const alias = "https://gdg.community.dev/events/details/old-slug";
    const canonical = "https://gdg.community.dev/events/details/current-slug";
    for (const [url, title, startDate] of [
      [alias, "Stale alias", "2099-01-10"],
      [canonical, "Canonical redirect fixture", "2099-02-01"],
    ])
      await db
        .prepare(
          "INSERT INTO events(id,url,title,community,type,start_date,description) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(url, url, title, event.community, event.type, startDate, event.description)
        .run();
    await persistReviewedEvent(
      db,
      applyEventOverrides({ ...event, url: canonical, startDate: "2099-02-01" }, [
        {
          url: canonical,
          evidenceUrl: proof.evidenceUrl,
          reviewedAt: "2026-10-12",
          patch: { lifecycle: { state: "cancelled", ...proof } },
        },
      ]),
    );
    globalThis.fetch = vi.fn(async () => {
      const response = new Response("", { status: 200 });
      Object.defineProperty(response, "url", { value: canonical });
      return response;
    });
    try {
      await withEventDatabase(db, async () => {
        const initial = await loadReviewedEventCollection(false);
        expect(initial.events.filter((e) => e.url === canonical)).toHaveLength(1);
        expect(initial.events.some((e) => e.url === alias)).toBe(false);
        expect(initial.events.find((e) => e.url === canonical)?.status).toBeUndefined();
        const body = await (
          await get(ApiRoute)({ request: new Request("https://openodia.com/api/events") })
        ).json();
        expect(body.events.filter((e: Event) => e.url === canonical)).toHaveLength(1);
        expect(body.events.some((e: Event) => e.url === alias)).toBe(false);
        const rss = await (
          await get(FeedRoute)({ request: new Request("https://openodia.com/events-feed") })
        ).text();
        expect(rss).not.toContain(alias);
        const snapshot = await buildSearchSnapshot(emptyLoaders);
        expect(snapshot.documents.some((e) => e.id === `event:${alias}`)).toBe(false);
        expect(snapshot.documents.find((e) => e.id === `event:${canonical}`)?.summary).toContain(
          "Cancelled",
        );
      });
    } finally {
      for (const url of [alias, canonical]) {
        await db.prepare("DELETE FROM events WHERE id=?").bind(url).run();
        await db.prepare("DELETE FROM event_reviewed_metadata WHERE event_id=?").bind(url).run();
      }
    }
  });
  it("restores reviewed fields for checked-in events even when their base D1 row is absent", async () => {
    fixture.events = [{ ...event, url: "https://example.org/curated", title: "Curated event" }];
    const reviewed = applyEventOverrides(fixture.events[0], [
      {
        url: fixture.events[0].url,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-12",
        patch: { lifecycle: { state: "postponed", ...proof } },
      },
    ]);
    await persistReviewedEvent(db, reviewed);
    const data = await withEventDatabase(db, loadReviewedEventCollection);
    expect(data.events.find((row) => row.url === reviewed.url)?.lifecycle?.state).toBe("postponed");
  });
  it("does not reuse a memoized snapshot across request databases", async () => {
    const load = createSearchSnapshotLoader(emptyLoaders, "test-reviewed-request-database");
    const snapshot = await withEventDatabase(db, load);
    expect(snapshot.documents.find((doc) => doc.kind === "event")?.summary).toContain("Cancelled");
    const other: D1Like = {
      prepare: () => ({
        bind() {
          return this;
        },
        run: async () => ({}),
        all: async <T>() => ({ results: [] as T[] }),
      }),
    };
    globalThis.fetch = vi.fn(async () => new Response("offline", { status: 503 }));
    const independent = await withEventDatabase(other, load);
    expect(independent.documents.some((doc) => doc.kind === "event")).toBe(false);
  });
});

describe("canonical collection fallback boundaries", () => {
  it("renders checked-in records without a database or live request during SSR", async () => {
    fixture.events = [event];
    globalThis.fetch = vi.fn(async () => {
      throw new Error("SSR must not crawl");
    });
    const result = await withEventDatabase(undefined, () => loadReviewedEventCollection(false));
    expect(result.events[0].title).toBe(event.title);
    expect(result.source).toBe("scrape");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("retains checked-in corrections on a legacy database without the sidecar and uses ISO dates if ICU is unavailable", async () => {
    fixture.events = [event];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("ICU absent");
    });
    const legacy: D1Like = {
      prepare: () => ({
        bind() {
          return this;
        },
        run: async () => ({}),
        all: async () => {
          throw new Error("no such table: event_reviewed_metadata");
        },
      }),
    };
    const result = await withEventDatabase(legacy, () => loadReviewedEventCollection(false));
    expect(result.events[0].status).toBe("upcoming");
    expect(result.partial).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "Event persistence unavailable; using checked-in and live records",
    );
  });
  it("serves partial API/RSS/search and Worker fallback when the bound database is temporarily broken", async () => {
    fixture.events = [event];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const prepare = vi.fn(() => ({
      bind() {
        return this;
      },
      run: async () => ({}),
      all: async () => {
        throw new Error("temporary DB failure");
      },
    }));
    const broken: D1Like = { prepare };
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          '<script id="__NEXT_DATA__" type="application/json">' +
            JSON.stringify({
              props: { pageProps: { prerenderData: { upcomingEvents: [], pastEvents: [] } } },
            }) +
            "</script>",
        ),
    );
    await withEventDatabase(broken, async () => {
      for (const suffix of ["", "?page=1&limit=1"]) {
        const response = await get(ApiRoute)({
          request: new Request("https://openodia.com/api/events" + suffix),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect((await response.json()).partial).toBe(true);
      }
      const feed = await get(FeedRoute)({
        request: new Request("https://openodia.com/events-feed"),
      });
      expect(feed.status).toBe(200);
      expect(feed.headers.get("X-OpenOdia-Partial")).toBe("true");
      const snapshot = await buildSearchSnapshot(emptyLoaders);
      expect(snapshot.sources).toContainEqual(
        expect.objectContaining({ source: "events", status: "partial" }),
      );
    });
    const { default: worker } = await import("../src/server");
    for (const suffix of ["", "?page=1&limit=1"]) {
      const response = await worker.fetch(
        new Request("https://openodia.com/api/events" + suffix),
        { EVENTS_DB: broken },
        {},
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect((await response.json()).partial).toBe(true);
    }
    expect(prepare).toHaveBeenCalledTimes(6);
  });
  it("keeps loaded facts and marks a partial response if only the second metadata read fails", async () => {
    fixture.events = [event];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let sidecarReads = 0;
    const intermittent: D1Like = {
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => {
            if (sql.includes("event_reviewed_metadata")) {
              sidecarReads++;
              if (sidecarReads === 2) throw new Error("temporary metadata failure");
              return { results: [] as T[] };
            }
            return {
              results: [
                {
                  url: event.url,
                  title: event.title,
                  community: event.community,
                  type: event.type,
                  start_date: event.startDate,
                  description: event.description,
                },
              ] as T[],
            };
          },
        };
      },
    };
    const result = await withEventDatabase(intermittent, () => loadReviewedEventCollection(false));
    expect(result.events[0].title).toBe(event.title);
    expect(result.partial).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "Reviewed event metadata unavailable; retaining checked-in corrections",
    );
  });
  it.each([new Error("database unavailable"), "database unavailable"])(
    "serves a marked fallback without retrying a broken database: %s",
    async (error) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const unavailable: D1Like = {
        prepare: () => ({
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async () => {
            throw error;
          },
        }),
      };
      const fallback = await withEventDatabase(unavailable, () =>
        loadReviewedEventCollection(false),
      );
      expect(fallback.partial).toBe(true);
      expect(fallback.source).toBe("scrape");
      expect(warn).toHaveBeenCalledWith(
        "Event persistence unavailable; using checked-in and live records",
      );
    },
  );
});
