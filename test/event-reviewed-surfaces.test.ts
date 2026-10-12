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
    expect(warn).toHaveBeenCalledWith(
      "Reviewed event metadata unavailable; retaining checked-in corrections",
    );
  });
  it.each([new Error("database unavailable"), "database unavailable"])(
    "does not conceal non-migration persistence errors: %s",
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
      await expect(
        withEventDatabase(unavailable, () => loadReviewedEventCollection(false)),
      ).rejects.toBe(error);
      expect(warn).toHaveBeenCalledWith(
        "Event persistence unavailable; using checked-in and live records",
      );
    },
  );
});
