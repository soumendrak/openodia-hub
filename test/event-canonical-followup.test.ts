// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { events as curated, type Event } from "../src/data/events";
import { eventUrlKey } from "../src/lib/event-url";
import { applyEventOverrides, validEventPatch } from "../src/lib/event-lifecycle";
import { persistReviewedEvent } from "../src/lib/event-reviewed-store";
import { withEventDatabase } from "../src/lib/event-request-context";
import { loadReviewedEventCollection } from "../src/lib/sources/events";
import { buildSearchSnapshot, loadLiveSearchEvents } from "../src/lib/sources/search";
import { Route as ApiRoute } from "../src/routes/api/events";
import { Route as FeedRoute } from "../src/routes/events-feed";
import type { D1Like } from "../src/lib/events-store";

const original = curated.find((event) =>
  event.url.startsWith("https://gdg.community.dev/events/details/"),
)!;
const canonical = "https://gdg.community.dev/events/details/p1-canonical-followup";
const proof = { evidenceUrl: "https://example.org/official", verifiedAt: "2026-10-13" };
const corrected = applyEventOverrides({ ...original, url: canonical }, [
  {
    url: canonical,
    evidenceUrl: proof.evidenceUrl,
    reviewedAt: "2026-10-13",
    patch: {
      lifecycle: { state: "cancelled", ...proof },
      registration: { state: "closed", ...proof },
    },
  },
]);
const get = (route: unknown) =>
  (
    route as {
      options: { server: { handlers: { GET: (args: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.GET;
const loaders = {
  catalog: async () => [],
  papers: async () => [],
  videos: async () => [],
  events: loadLiveSearchEvents,
};
let mf: Miniflare;
let db: D1Like;
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch:()=>new Response('')}",
    d1Databases: ["EVENTS_DB"],
  });
  db = await mf.getD1Database("EVENTS_DB");
  for (const sql of readFileSync("db/schema.sql", "utf8")
    .split(";")
    .filter((sql) => sql.trim()))
    await db.prepare(sql).run();
});
afterAll(() => mf.dispose());
beforeEach(async () => {
  for (const table of ["events", "event_reviewed_metadata", "event_destination_aliases"])
    await db.prepare(`DELETE FROM ${table}`).run();
});
afterEach(() => vi.unstubAllGlobals());
async function seedCanonicalReview(withBase: boolean) {
  await db
    .prepare("INSERT INTO event_destination_aliases VALUES(?,?,?)")
    .bind(eventUrlKey(original.url), canonical, "2026-10-13")
    .run();
  await persistReviewedEvent(db, corrected);
  if (withBase)
    await db
      .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
      .bind(
        canonical,
        canonical,
        original.title,
        original.community,
        original.type,
        original.startDate ?? "2026-01-01",
      )
      .run();
}

it("consumes an already resolved full event collection without adding raw curated aliases", async () => {
  const snapshot = await buildSearchSnapshot({
    ...loaders,
    events: async () => ({ events: [corrected], source: "d1", partial: false }),
  });
  expect(snapshot.documents.filter((document) => document.kind === "event")).toHaveLength(1);
  expect(snapshot.documents.find((document) => document.kind === "event")).toMatchObject({
    externalHref: canonical,
    summary: expect.stringContaining("Cancelled"),
  });
});
it("still merges curated history for injected raw event arrays", async () => {
  const snapshot = await buildSearchSnapshot({ ...loaders, events: async () => [corrected] });
  expect(snapshot.documents.some((document) => document.externalHref === original.url)).toBe(true);
  expect(snapshot.documents.some((document) => document.externalHref === canonical)).toBe(true);
});

it("default search and RSS preserve one cancelled canonical entry for an actual checked-in GDG alias", async () => {
  await seedCanonicalReview(true);
  const fetcher = vi.fn(async () => {
    throw new Error("No upstream requests expected");
  });
  vi.stubGlobal("fetch", fetcher);
  await withEventDatabase(db, async () => {
    const snapshot = await buildSearchSnapshot(loaders);
    expect(
      snapshot.documents.filter((document) => document.externalHref === canonical),
    ).toHaveLength(1);
    expect(snapshot.documents.some((document) => document.externalHref === original.url)).toBe(
      false,
    );
    expect(
      snapshot.documents.find((document) => document.externalHref === canonical)?.summary,
    ).toContain("Cancelled");
    const feed = await get(FeedRoute)({ request: new Request("https://openodia.com/events-feed") });
    const xml = await feed.text();
    expect(xml).not.toContain(original.url);
    expect(xml.split(`<link>${canonical}</link>`)).toHaveLength(2);
    expect(xml).toContain("[Cancelled]");
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it("canonical reviews without a canonical base override older alias facts and survive old-sidecar removal", async () => {
  await seedCanonicalReview(false);
  const older = applyEventOverrides(original, [
    {
      url: original.url,
      evidenceUrl: proof.evidenceUrl,
      reviewedAt: "2026-10-12",
      patch: {
        lifecycle: { state: "scheduled", evidenceUrl: proof.evidenceUrl, verifiedAt: "2026-10-12" },
        attendance: { policy: "restricted", note: "Retained independent review" },
      },
    },
  ]);
  await persistReviewedEvent(db, older);
  const fetcher = vi.fn(async (_input, init) => {
    if (init?.method === "HEAD") throw new Error("Request-time HEAD forbidden");
    return new Response("offline", { status: 503 });
  });
  vi.stubGlobal("fetch", fetcher);
  await withEventDatabase(db, async () => {
    const collection = await loadReviewedEventCollection(false);
    expect(collection.events.find((event) => event.url === canonical)).toMatchObject({
      lifecycle: { state: "cancelled" },
      registration: { state: "closed" },
      attendance: { policy: "restricted" },
      reviewedAt: "2026-10-13T00:00:00.000Z",
    });
    await db
      .prepare("DELETE FROM event_reviewed_metadata WHERE event_id=?")
      .bind(eventUrlKey(original.url))
      .run();
    const api = await get(ApiRoute)({ request: new Request("https://openodia.com/api/events") });
    expect(api.headers.get("Cache-Control")).toBe("no-store");
    const body = await api.json();
    expect(body.partial).toBe(true);
    expect(body.events.find((event: Event) => event.url === canonical)).toMatchObject({
      lifecycle: { state: "cancelled" },
      registration: { state: "closed" },
    });
    expect(body.events.some((event: Event) => event.url === original.url)).toBe(false);
    const snapshot = await buildSearchSnapshot(loaders);
    expect(snapshot.documents.some((document) => document.externalHref === original.url)).toBe(
      false,
    );
    expect(
      snapshot.documents.find((document) => document.externalHref === canonical)?.summary,
    ).toContain("Cancelled");
    expect(snapshot.sources.find((source) => source.source === "events")?.status).toBe("partial");
    const feed = await get(FeedRoute)({ request: new Request("https://openodia.com/events-feed") });
    expect(feed.headers.get("Cache-Control")).toBe("no-store");
    expect(await feed.text()).not.toContain(original.url);
  });
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "HEAD")).toHaveLength(0);
});

it.each(["scheduled", "cancelled"] as const)("rejects previousDate on %s", async (state) => {
  const patch = { lifecycle: { state, ...proof, previousDate: "2026-09-01" } };
  expect(validEventPatch(patch)).toBe(false);
  await expect(
    persistReviewedEvent(db, {
      ...original,
      ...patch,
      reviewedAt: "2026-10-13",
      reviewedFields: ["lifecycle"],
    }),
  ).rejects.toThrow("Invalid reviewed event metadata");
});
it("admits previousDate on a postponed lifecycle", () => {
  expect(
    validEventPatch({ lifecycle: { state: "postponed", ...proof, previousDate: "2026-09-01" } }),
  ).toBe(true);
});

it("retains admitted facts and marks partial when the canonical-sidecar read fails", async () => {
  await seedCanonicalReview(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("No upstream requests expected");
    }),
  );
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const flaky = () => {
    let reads = 0;
    return {
      prepare(sql: string) {
        const statement = db.prepare(sql);
        return {
          bind: statement.bind.bind(statement),
          run: statement.run.bind(statement),
          all: async <T>() => {
            if (sql.includes("event_reviewed_metadata") && ++reads === 3)
              throw new Error("private metadata details");
            return statement.all<T>();
          },
        };
      },
    } satisfies D1Like;
  };
  try {
    const api = await withEventDatabase(flaky(), () =>
      get(ApiRoute)({ request: new Request("https://openodia.com/api/events") }),
    );
    expect(api.headers.get("Cache-Control")).toBe("no-store");
    const body = await api.json();
    expect(body.partial).toBe(true);
    expect(body.events.find((event: Event) => event.url === canonical)?.lifecycle?.state).toBe(
      "cancelled",
    );
    expect(warn).toHaveBeenCalledWith(
      "Canonical reviewed event metadata unavailable; retaining merged corrections",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private metadata details");
  } finally {
    warn.mockRestore();
  }
});

it("ignores cached previousDate facts on a scheduled lifecycle", async () => {
  await seedCanonicalReview(true);
  await db
    .prepare("UPDATE event_reviewed_metadata SET payload_json=? WHERE event_id=?")
    .bind(
      JSON.stringify({
        patch: { lifecycle: { state: "scheduled", ...proof, previousDate: "2026-09-01" } },
      }),
      canonical,
    )
    .run();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("No upstream requests expected");
    }),
  );
  const collection = await withEventDatabase(db, () => loadReviewedEventCollection(false));
  expect(collection.events.find((event) => event.url === canonical)?.lifecycle).toBeUndefined();
});

it.each(["2099-01-01", "2098-12-31"])(
  "keeps RSS newest-first chronology for %s while the canonical loader remains active-first",
  async (earlierDate) => {
    await seedCanonicalReview(true);
    await db.prepare("UPDATE events SET start_date='2099-12-31' WHERE id=?").bind(canonical).run();
    const upcoming = "https://example.org/earlier-upcoming";
    await db
      .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
      .bind(upcoming, upcoming, "Earlier upcoming", original.community, "Workshop", earlierDate)
      .run();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("No upstream requests expected");
      }),
    );
    await withEventDatabase(db, async () => {
      const collection = await loadReviewedEventCollection(false);
      expect(collection.events.findIndex((event) => event.url === upcoming)).toBeLessThan(
        collection.events.findIndex((event) => event.url === canonical),
      );
      const feed = await get(FeedRoute)({
        request: new Request("https://openodia.com/events-feed"),
      });
      const xml = await feed.text();
      expect(xml.indexOf(`<link>${canonical}</link>`)).toBeLessThan(
        xml.indexOf(`<link>${upcoming}</link>`),
      );
    });
  },
);
