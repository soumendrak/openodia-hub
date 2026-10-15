// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  D1_QUERY_LIMIT,
  readEventsFromD1,
  syncEventsToD1,
  syncQueryCount,
  type D1Like,
} from "../src/lib/events-store";
import { applyEventOverrides } from "../src/lib/event-lifecycle";
import { persistReviewedEvent } from "../src/lib/event-reviewed-store";
import type { Event } from "../src/data/events/types";
import { events as curated } from "../src/data/events";
import { eventUrlKey } from "../src/lib/event-url";

// Synthetic chapters are appended to the real list so the budget is measured at
// and beyond the chapter counts production is heading towards.
const scale = vi.hoisted(() => ({
  real: 0,
  chapters: [] as { slug: string; community: string; organizerId?: string }[],
}));
vi.mock("../src/routes/api/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/routes/api/events")>();
  scale.chapters.push(...actual.CHAPTERS);
  scale.real = actual.CHAPTERS.length;
  return { ...actual, CHAPTERS: scale.chapters };
});
/** Appends `extra` synthetic chapters to the real list (0 restores it). */
function addChapters(extra: number) {
  scale.chapters.splice(scale.real);
  for (let index = 0; index < extra; index++)
    scale.chapters.push({ slug: `budget-chapter-${index}`, community: `Budget Chapter ${index}` });
  return scale.chapters.length;
}

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
afterEach(async () => {
  for (const table of [
    "events",
    "event_reviewed_metadata",
    "event_destination_aliases",
    "event_source_memberships",
    "event_source_status",
  ])
    await db.prepare(`DELETE FROM ${table}`).run();
  vi.unstubAllGlobals();
  addChapters(0);
});
const proof = { evidenceUrl: "https://example.org/official", verifiedAt: "2026-10-12" };
const canonical = "https://gdg.community.dev/events/details/carry-current";
const alias = "https://gdg.community.dev/events/details/carry-old";
const fixture: Event = {
  url: alias,
  title: "Old alias",
  type: "Workshop",
  community: "GDG Bhubaneswar",
  date: "2099-01-01",
  year: "2099",
  startDate: "2099-01-01",
};
const page = (urls: string[]) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: { upcomingEvents: { results: urls.map((url) => ({ url, title: "Current upstream title", description: "Current description", event_type_title: "Workshop", start_date: "2099-02-01" })) }, pastEvents: { results: [] } } } } })}</script>`;

it("syncs 114 rows within D1 Free's query budget with constant parameters and retains reviewed alias facts after old-row retirement", async () => {
  await db
    .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
    .bind(alias, alias, fixture.title, fixture.community, fixture.type, fixture.startDate)
    .run();
  await persistReviewedEvent(
    db,
    applyEventOverrides(fixture, [
      {
        url: alias,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-12",
        patch: {
          lifecycle: { state: "cancelled", ...proof },
          registration: { state: "closed", ...proof },
        },
      },
    ]),
  );
  await persistReviewedEvent(
    db,
    applyEventOverrides({ ...fixture, url: canonical }, [
      {
        url: canonical,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-11",
        patch: {
          lifecycle: { state: "scheduled", ...proof, verifiedAt: "2026-10-11" },
          attendance: { policy: "restricted", note: "Members only" },
        },
      },
    ]),
  );
  await db
    .prepare("INSERT INTO event_destination_aliases VALUES(?,?,?)")
    .bind(alias, canonical, "2026-10-12")
    .run();
  const urls = [
    canonical,
    ...Array.from(
      { length: 113 },
      (_, index) => `https://gdg.community.dev/events/details/sync-${index}`,
    ),
  ];
  const fetcher = vi.fn(async (_input, init) =>
    init?.method === "HEAD" ? new Response(null) : new Response(page(urls)),
  );
  vi.stubGlobal("fetch", fetcher);
  let queries = 0;
  let maxParameters = 0;
  const counted: D1Like = {
    prepare(sql) {
      queries++;
      const statement = db.prepare(sql);
      return {
        all: statement.all.bind(statement),
        run: statement.run.bind(statement),
        bind(...values) {
          maxParameters = Math.max(maxParameters, values.length);
          return statement.bind(...values);
        },
      };
    },
  };
  expect(await syncEventsToD1(counted)).toEqual({ upserted: 114 });
  // D1 Free allows 50 queries per invocation; the count does not grow per event.
  expect(queries).toBeLessThanOrEqual(50);
  // Per-statement parameters stay constant (D1 allows 100), independent of row count.
  expect(maxParameters).toBeLessThanOrEqual(8);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "HEAD")).toHaveLength(30);
  expect(fetcher.mock.calls.filter(([, init]) => init?.method !== "HEAD")).toHaveLength(5);
  // Remove the old grace-period row and its review: the canonical sidecar must stand alone.
  await db.prepare("DELETE FROM events WHERE id=?").bind(alias).run();
  await db.prepare("DELETE FROM event_reviewed_metadata WHERE event_id=?").bind(alias).run();
  const current = (await readEventsFromD1(db)).find((event) => event.url === canonical);
  expect(current).toMatchObject({
    title: "Current upstream title",
    lifecycle: { state: "cancelled" },
    registration: { state: "closed" },
    attendance: { policy: "restricted" },
    reviewedAt: "2026-10-12T00:00:00.000Z",
  });
  const sidecar = await db
    .prepare("SELECT reviewed_at FROM event_reviewed_metadata WHERE event_id=?")
    .bind(canonical)
    .all<{ reviewed_at: string }>();
  expect(sidecar.results[0].reviewed_at).toBe("2026-10-12T00:00:00.000Z");
});

it("does not retire old rows when a chapter fails", async () => {
  await db
    .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
    .bind(alias, alias, fixture.title, fixture.community, fixture.type, fixture.startDate)
    .run();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) =>
      init?.method === "HEAD"
        ? new Response(null)
        : String(input).includes("gdg-bhubaneswar/")
          ? new Response("offline", { status: 503 })
          : new Response(page([canonical])),
    ),
  );
  await syncEventsToD1(db);
  expect(
    (
      await db
        .prepare("SELECT is_active FROM events WHERE id=?")
        .bind(alias)
        .all<{ is_active: number }>()
    ).results[0].is_active,
  ).toBe(1);
});

it("does not seed an empty database from a partial run", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) =>
      init?.method === "HEAD"
        ? new Response(null)
        : String(input).includes("gdg-bhubaneswar/")
          ? new Response("offline", { status: 503 })
          : new Response(page([canonical])),
    ),
  );
  await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 0 });
  const { results } = await db.prepare("SELECT COUNT(*) AS n FROM events").all<{ n: number }>();
  expect(results[0].n).toBe(0);
});

it.each(["absent", "expired"])(
  "caches reviewed curated alias facts without fabricating rows when its old base is %s",
  async (oldBase) => {
    const primary = curated.find((event) =>
      event.url.startsWith("https://gdg.community.dev/events/details/"),
    )!;
    const key = eventUrlKey(primary.url);
    await persistReviewedEvent(
      db,
      applyEventOverrides(primary, [
        {
          url: primary.url,
          evidenceUrl: proof.evidenceUrl,
          reviewedAt: "2026-10-12",
          patch: {
            lifecycle: { state: "cancelled", ...proof },
            registration: { state: "closed", ...proof },
          },
        },
      ]),
    );
    if (oldBase === "expired")
      await db
        .prepare(
          "INSERT INTO events(id,url,title,community,type,start_date,is_active,last_seen) VALUES(?,?,?,?,?,?,0,'2000-01-01')",
        )
        .bind(
          key,
          primary.url,
          primary.title,
          primary.community,
          primary.type,
          primary.startDate ?? "2026-01-01",
        )
        .run();
    await db
      .prepare("INSERT INTO event_destination_aliases VALUES(?,?,?)")
      .bind(key, canonical, "2026-10-12")
      .run();
    let hasLive = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) =>
        init?.method === "HEAD"
          ? new Response(null)
          : new Response(
              page(hasLive && String(input).includes("gdg-bhubaneswar/") ? [canonical] : []),
            ),
      ),
    );
    expect(await syncEventsToD1(db)).toEqual({ upserted: 0 });
    expect(
      (await db.prepare("SELECT id FROM events WHERE id=?").bind(canonical).all()).results,
    ).toEqual([]);
    const cached = await db
      .prepare("SELECT reviewed_at,payload_json FROM event_reviewed_metadata WHERE event_id=?")
      .bind(canonical)
      .all<{ reviewed_at: string; payload_json: string }>();
    expect(cached.results).toHaveLength(1);
    expect(cached.results[0].reviewed_at).toBe("2026-10-12T00:00:00.000Z");
    expect(JSON.parse(cached.results[0].payload_json).patch).toMatchObject({
      lifecycle: { state: "cancelled" },
      registration: { state: "closed" },
    });
    hasLive = true;
    expect(await syncEventsToD1(db)).toEqual({ upserted: 1 });
    await db.prepare("DELETE FROM event_reviewed_metadata WHERE event_id=?").bind(key).run();
    const rows = await readEventsFromD1(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      url: canonical,
      lifecycle: { state: "cancelled" },
      registration: { state: "closed" },
      reviewedAt: "2026-10-12T00:00:00.000Z",
    });
  },
);

const chapterPage = (slug: string, count: number, start = "2099-02-01") =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: {
            count,
            links: { next: null },
            results: Array.from({ length: count }, (_, index) => ({
              url: `https://gdg.community.dev/events/details/${slug}-${index}`,
              title: `${slug} event ${index}`,
              description: "Distinct chapter event",
              event_type_title: "Workshop",
              start_date: start,
            })),
          },
          pastEvents: { count: 0, links: { next: null }, results: [] },
        },
      },
    },
  })}</script>`;

function counting(target: D1Like) {
  const counter = { queries: 0 };
  const wrapped: D1Like = {
    prepare(sql) {
      counter.queries++;
      return target.prepare(sql);
    },
    batch: (statements) => (target.batch ? target.batch(statements) : Promise.resolve()),
  };
  return { counter, wrapped };
}

// Each chapter serves its own distinct, complete list; on the second run one
// event per chapter has gone, so the retirement statements are built and run.
it.each([4, 5, 9])(
  "stays within D1's query budget at %i extra chapters and retires removed rows",
  async (extra) => {
    const chapters = addChapters(extra);
    const CHAPTERS = scale.chapters;
    let perChapter = 3;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        if (init?.method === "HEAD") return new Response(null);
        const slug = CHAPTERS.find((chapter) => String(input).includes(`/${chapter.slug}/`))!.slug;
        return new Response(chapterPage(slug, perChapter));
      }),
    );
    const first = counting(db);
    expect(await syncEventsToD1(first.wrapped)).toEqual({ upserted: chapters * 3 });
    // syncQueryCount is the ceiling; the alias and review writes are skipped when empty.
    expect(first.counter.queries).toBeLessThanOrEqual(syncQueryCount(chapters));
    expect(first.counter.queries).toBeGreaterThanOrEqual(syncQueryCount(chapters) - 2);
    expect(first.counter.queries).toBeLessThanOrEqual(D1_QUERY_LIMIT);

    perChapter = 2;
    const second = counting(db);
    expect(await syncEventsToD1(second.wrapped)).toEqual({ upserted: chapters * 2 });
    expect(second.counter.queries).toBeLessThanOrEqual(syncQueryCount(chapters));
    const { results } = await db
      .prepare("SELECT id, is_active FROM events WHERE id LIKE '%-2' ORDER BY id")
      .all<{ id: string; is_active: number }>();
    expect(results).toHaveLength(chapters);
    expect(results.every((row) => row.is_active === 0)).toBe(true);
    const active = await db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE is_active = 1")
      .all<{ n: number }>();
    expect(active.results[0].n).toBe(chapters * 2);
  },
);

it("refuses to start a sync whose chapter count would exceed the query limit", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  let extra = 0;
  while (syncQueryCount(addChapters(extra)) <= D1_QUERY_LIMIT) extra++;
  const { counter, wrapped } = counting(db);
  await expect(syncEventsToD1(wrapped)).rejects.toThrow(/D1 queries; the limit is 50/);
  expect(counter.queries).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});

// Kills the `mergeReviewedEvents(old, event)` -> `event` mutant: a reviewed start
// date in the sidecar must reach the stored row, because start_date feeds retirement.
it("writes the reviewed start date, not the upstream one, into the D1 row", async () => {
  const url = "https://gdg.community.dev/events/details/reviewed-start";
  const base: Event = { ...fixture, url, title: "Reviewed start", startDate: "2099-02-01" };
  await db
    .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
    .bind(eventUrlKey(url), url, base.title, base.community, base.type, base.startDate)
    .run();
  await persistReviewedEvent(
    db,
    applyEventOverrides(base, [
      {
        url,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-12",
        patch: { startDate: "2099-03-15" },
      },
    ]),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) =>
      init?.method === "HEAD"
        ? new Response(null)
        : new Response(page(String(input).includes("gdg-bhubaneswar/") ? [url] : [])),
    ),
  );
  expect(await syncEventsToD1(db)).toEqual({ upserted: 1 });
  const { results } = await db
    .prepare("SELECT start_date FROM events WHERE id=?")
    .bind(eventUrlKey(url))
    .all<{ start_date: string }>();
  expect(results).toEqual([{ start_date: "2099-03-15" }]);
});

it("skips and logs invalid merged reviewed metadata instead of aborting the sync", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const url = "https://gdg.community.dev/events/details/invalid-review";
  // A stored reviewed end before the live start makes the merged range invalid.
  await db
    .prepare("INSERT INTO event_reviewed_metadata VALUES(?,?,?)")
    .bind(
      eventUrlKey(url),
      JSON.stringify({ patch: { endDate: "2099-01-05" } }),
      "2026-10-12T00:00:00.000Z",
    )
    .run();
  await db
    .prepare("INSERT INTO events(id,url,title,community,type,start_date) VALUES(?,?,?,?,?,?)")
    .bind(eventUrlKey(url), url, "Invalid review", fixture.community, "Workshop", "2099-01-01")
    .run();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) =>
      init?.method === "HEAD"
        ? new Response(null)
        : new Response(page(String(input).includes("gdg-bhubaneswar/") ? [url] : [])),
    ),
  );
  await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 1 });
  expect(warn.mock.calls.some(([message]) => /skipped/.test(String(message)))).toBe(true);
  warn.mockRestore();
});
