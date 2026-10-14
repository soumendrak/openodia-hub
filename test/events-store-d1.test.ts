// @vitest-environment node
// Runs syncEventsToD1 against a real (miniflare) D1 built from db/schema.sql,
// so the retirement SQL itself is exercised rather than a reimplementation.
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readEventsFromD1, syncEventsToD1, UPSERT_SQL, type D1Like } from "../src/lib/events-store";
import { eventUrlKey } from "../src/lib/event-url";

type D1 = D1Like & { prepare: (sql: string) => ReturnType<D1Like["prepare"]> };
type List = { results: unknown[]; count?: number; next?: string };

const BBSR = "/gdg-bhubaneswar/";
const KIIT = "kalinga-institute";
const CVR = "c-v-raman";
const url = (slug: string) => `https://gdg.community.dev/events/details/${slug}`;
const ev = (slug: string, start = "2025-01-01") => ({
  title: slug,
  start_date: `${start}T10:00:00Z`,
  url: url(slug),
});
const list = (results: unknown[] = [], extra: Partial<List> = {}) => ({
  results,
  count: results.length,
  ...extra,
});
const page = (prerenderData: unknown) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { prerenderData } },
  })}</script>`;
const lists = (upcoming = list(), past = list()) =>
  page({
    upcomingEvents: { ...upcoming, links: { next: upcoming.next ?? null } },
    pastEvents: { ...past, links: { next: past.next ?? null } },
  });

/** Serves a page (or an HTTP status / thrown error) per chapter; others are complete and empty. */
function serve(pages: Record<string, string | number | Error>) {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const key = Object.keys(pages).find((k) => String(input).includes(k));
    const body = key === undefined ? lists() : pages[key];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body } as Response;
    return { ok: true, status: 200, text: async () => body } as Response;
  }) as typeof fetch;
}

let mf: Miniflare;
let db: D1;

async function seed(rows: [slug: string, community: string, start?: string, source?: string][]) {
  for (const [slug, community, start = "2025-01-01", source = "bevy"] of rows) {
    await db
      .prepare(
        "INSERT INTO events (id, url, title, community, type, start_date, source) VALUES (?, ?, ?, ?, 'Talk', ?, ?)",
      )
      .bind(eventUrlKey(url(slug)), url(slug), slug, community, start, source)
      .run();
  }
}

async function activeBySlug(): Promise<Record<string, number>> {
  const { results } = await db
    .prepare("SELECT title, is_active FROM events")
    .all<{ title: string; is_active: number }>();
  return Object.fromEntries(results.map((r) => [r.title, r.is_active]));
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch: () => new Response('') }",
    d1Databases: ["EVENTS_DB"],
  });
  db = (await mf.getD1Database("EVENTS_DB")) as unknown as D1;
});

afterAll(() => mf.dispose());

const originalFetch = globalThis.fetch;
beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await db.prepare("DROP TABLE IF EXISTS events").run();
  await db.prepare("DROP TABLE IF EXISTS event_source_memberships").run();
  await db.prepare("DROP TABLE IF EXISTS event_source_status").run();
  const schema = readFileSync("db/schema.sql", "utf8").replace(/--.*$/gm, "");
  for (const statement of schema.split(";").map((s) => s.trim())) {
    if (statement) await db.prepare(statement).run();
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("syncEventsToD1 against a real D1", () => {
  it("retires only rows that a successful chapter no longer lists", async () => {
    serve({
      [BBSR]: lists(list(), list([ev("bbsr-listed")])),
      [KIIT]: 503,
      [CVR]: new Error("network timeout"),
    });
    await seed([
      ["bbsr-listed", "GDG Bhubaneswar"],
      ["bbsr-gone", "GDG Bhubaneswar"],
      ["kiit-1", "GDGoC KIIT"],
      ["cvr-1", "GDGoC CVR University"],
      ["static-under-bbsr", "GDG Bhubaneswar", "2025-01-01", "static"],
      // GDGoC IIIT Bhubaneswar is no longer in CHAPTERS (removed in 7524ff0).
      ["iiit-old", "GDGoC IIIT Bhubaneswar"],
    ]);

    await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 1 });
    expect(await activeBySlug()).toEqual({
      "bbsr-listed": 1,
      "bbsr-gone": 0,
      "kiit-1": 1,
      "cvr-1": 1,
      "static-under-bbsr": 1,
      "iiit-old": 1,
    });
  });

  it.each([
    ["has no event lists", page({ upcoming: [], past: [] })],
    ["lists entries without a start date", lists(list([{ title: "x", url: url("kiit-new") }]))],
  ])("keeps a chapter's rows when its page %s", async (_, kiitPage) => {
    serve({ [BBSR]: lists(list([ev("bbsr-listed")])), [KIIT]: kiitPage });
    await seed([
      ["kiit-1", "GDGoC KIIT"],
      ["bbsr-gone", "GDG Bhubaneswar"],
    ]);

    await syncEventsToD1(db);
    expect(await activeBySlug()).toMatchObject({ "kiit-1": 1, "bbsr-gone": 0 });
  });

  it.each([
    ["count exceeds the results", { count: 87 }],
    ["count under-reports the results", { count: 0 }],
    ["a next page is linked", { next: "http://testserver/api/event_slim/?page=2" }],
  ])("retires only upcoming rows when the past list is truncated (%s)", async (_, extra) => {
    serve({
      [BBSR]: lists(list([ev("bbsr-next", "2099-01-01")]), list([ev("bbsr-recent")], extra)),
    });
    await seed([
      ["bbsr-next", "GDG Bhubaneswar", "2099-01-01"],
      ["bbsr-recent", "GDG Bhubaneswar"],
      ["bbsr-older-past", "GDG Bhubaneswar", "2024-03-01"],
      ["bbsr-cancelled", "GDG Bhubaneswar", "2099-02-01"],
    ]);

    await syncEventsToD1(db);
    expect(await activeBySlug()).toEqual({
      "bbsr-next": 1,
      "bbsr-recent": 1,
      "bbsr-older-past": 1,
      "bbsr-cancelled": 0,
    });
  });

  it.each([
    ["both lists count 0 (a real zero)", lists(), { past: 0, upcoming: 0 }],
    [
      "the upcoming list has no count",
      lists(list([], { count: undefined })),
      { past: 1, upcoming: 1 },
    ],
    [
      "the upcoming list has an invalid count",
      lists(list([], { count: -1 })),
      { past: 1, upcoming: 1 },
    ],
    ["the upcoming list counts 3", lists(list([], { count: 3 })), { past: 1, upcoming: 1 }],
    ["the past list counts 5", lists(list(), list([], { count: 5 })), { past: 1, upcoming: 0 }],
  ])("an empty KIIT page where %s", async (_, kiitPage, expected) => {
    serve({ [BBSR]: lists(list([ev("bbsr-listed")])), [KIIT]: kiitPage });
    await seed([
      ["kiit-past", "GDGoC KIIT"],
      ["kiit-upcoming", "GDGoC KIIT", "2099-01-01"],
    ]);

    await syncEventsToD1(db);
    const active = await activeBySlug();
    expect({ past: active["kiit-past"], upcoming: active["kiit-upcoming"] }).toEqual(expected);
  });

  it("reactivates an event and its membership when it is listed again", async () => {
    const state = async () => ({
      event: (await activeBySlug())["bbsr-back"],
      membership: (
        await db
          .prepare("SELECT is_active FROM event_source_memberships WHERE source_id = ?")
          .bind("gdg-bhubaneswar")
          .first<{ is_active: number }>()
      )?.is_active,
    });
    serve({ [BBSR]: lists(list(), list([ev("bbsr-back")])) });
    await syncEventsToD1(db);
    expect(await state()).toEqual({ event: 1, membership: 1 });
    serve({ [BBSR]: lists() });
    await syncEventsToD1(db);
    expect(await state()).toEqual({ event: 0, membership: 0 });
    serve({ [BBSR]: lists(list(), list([ev("bbsr-back")])) });
    await syncEventsToD1(db);
    expect(await state()).toEqual({ event: 1, membership: 1 });
  });

  it("keeps inactive rows visible for the 30-day grace window only", async () => {
    await seed([
      ["active", "GDG Bhubaneswar"],
      ["inactive-recent", "GDG Bhubaneswar"],
      ["inactive-expired", "GDG Bhubaneswar"],
    ]);
    for (const [slug, age] of [
      ["inactive-recent", "-29 days"],
      ["inactive-expired", "-31 days"],
    ]) {
      await db
        .prepare("UPDATE events SET is_active = 0, last_seen = datetime('now', ?) WHERE title = ?")
        .bind(age, slug)
        .run();
    }
    const titles = (await readEventsFromD1(db)).map((event) => event.title).sort();
    expect(titles).toEqual(["active", "inactive-recent"]);
  });

  it("migrates legacy rows to memberships by exact registry alias only", async () => {
    serve({ [BBSR]: 503 });
    await seed([
      ["legacy-alias", "Google Developer Group Bhubaneswar"],
      ["legacy-canonical", "GDG Bhubaneswar"],
      ["legacy-unknown", "Some Other Group"],
    ]);
    await db.prepare("UPDATE events SET is_active = 0 WHERE title = 'legacy-canonical'").run();
    await syncEventsToD1(db);
    const { results } = await db
      .prepare(
        `SELECT e.title, m.source_id, m.is_active FROM event_source_memberships m
         JOIN events e ON e.id = m.event_id ORDER BY e.title`,
      )
      .all<{ title: string; source_id: string; is_active: number }>();
    expect(results).toEqual([
      { title: "legacy-alias", source_id: "gdg-bhubaneswar", is_active: 1 },
      { title: "legacy-canonical", source_id: "gdg-bhubaneswar", is_active: 0 },
    ]);
  });

  it("retires rows owned only by a removed chapter's orphaned membership", async () => {
    await seed([
      ["orphan-only", "Removed Chapter"],
      ["orphan-and-live", "Removed Chapter"],
    ]);
    const id = (slug: string) => eventUrlKey(url(slug));
    for (const [slug, source] of [
      ["orphan-only", "removed-chapter"],
      ["orphan-and-live", "removed-chapter"],
      ["orphan-and-live", "gdg-bhubaneswar"],
    ]) {
      await db
        .prepare(
          "INSERT INTO event_source_memberships (event_id, source_id, is_active) VALUES (?, ?, 1)",
        )
        .bind(id(slug), source)
        .run();
    }
    serve({ [BBSR]: lists(list(), list([ev("orphan-and-live")])) });
    await syncEventsToD1(db);
    expect(await activeBySlug()).toMatchObject({ "orphan-only": 0, "orphan-and-live": 1 });
  });

  it("starts the grace window when a long-protected event finally retires", async () => {
    await seed([["stale-owned", "GDG Bhubaneswar"]]);
    const id = eventUrlKey(url("stale-owned"));
    await db
      .prepare("UPDATE events SET last_seen = datetime('now', '-60 days') WHERE id = ?")
      .bind(id)
      .run();
    await db
      .prepare("INSERT INTO event_source_memberships VALUES (?, 'gdg-bhubaneswar', 1)")
      .bind(id)
      .run();
    serve({});
    await syncEventsToD1(db);
    expect(await activeBySlug()).toMatchObject({ "stale-owned": 0 });
    expect((await readEventsFromD1(db)).map((event) => event.title)).toContain("stale-owned");
  });

  it("keeps an event dated today (IST) when the past list is truncated", async () => {
    const todayIst = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
    serve({ [BBSR]: lists(list([ev("bbsr-next", "2099-01-01")]), list([], { count: 87 })) });
    await seed([
      ["bbsr-next", "GDG Bhubaneswar", "2099-01-01"],
      ["bbsr-today", "GDG Bhubaneswar", todayIst],
      ["bbsr-tomorrow-gone", "GDG Bhubaneswar", "2099-03-01"],
    ]);
    await syncEventsToD1(db);
    expect(await activeBySlug()).toEqual({
      "bbsr-next": 1,
      "bbsr-today": 1,
      "bbsr-tomorrow-gone": 0,
    });
  });

  it("commits no deactivation when a later write in the same sync fails", async () => {
    serve({ [BBSR]: lists() });
    await seed([["bbsr-kept", "GDG Bhubaneswar"]]);
    await syncEventsToD1(db);
    const flaky: D1 = {
      prepare: (sql: string) => {
        if (sql.includes("event_source_status")) throw new Error("status write failed");
        return db.prepare(sql);
      },
      batch: db.batch!.bind(db),
    };
    await db.prepare("UPDATE event_source_memberships SET is_active = 1").run();
    await db.prepare("UPDATE events SET is_active = 1").run();
    await expect(syncEventsToD1(flaky)).rejects.toThrow("status write failed");
    const membership = await db
      .prepare("SELECT is_active FROM event_source_memberships")
      .first<{ is_active: number }>();
    expect(membership?.is_active).toBe(1);
    expect(await activeBySlug()).toEqual({ "bbsr-kept": 1 });
  });

  it("stays within D1 Free's 50 queries per invocation for a 90-event sync", async () => {
    const many = (prefix: string) =>
      list(Array.from({ length: 30 }, (_, index) => ev(`${prefix}-${index}`)));
    serve({ [BBSR]: lists(many("bbsr")), [KIIT]: lists(many("kiit")), [CVR]: lists(many("cvr")) });
    let queries = 0;
    const counted = (statement: ReturnType<D1["prepare"]>): ReturnType<D1["prepare"]> =>
      new Proxy(statement, {
        get(target, key) {
          if (key === "bind") return (...values: unknown[]) => counted(target.bind(...values));
          if (key === "run" || key === "all" || key === "first") queries += 1;
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    const counting: D1 = {
      prepare: (sql: string) => counted(db.prepare(sql)),
      batch: (statements) => {
        queries += statements.length; // D1 counts every batched statement.
        return db.batch!(statements);
      },
    };
    await expect(syncEventsToD1(counting)).resolves.toEqual({ upserted: 90 });
    expect(queries).toBeLessThanOrEqual(50);
    expect(Object.keys(await activeBySlug())).toHaveLength(90);
  });

  it("writes and updates all nine event columns through UPSERT_SQL", async () => {
    const columns = "id, url, title, community, type, start_date, end_date, description, location";
    const roundTrip = async (row: (string | null)[]) => {
      await db
        .prepare(UPSERT_SQL)
        .bind(JSON.stringify([row]))
        .run();
      const stored = await db
        .prepare(`SELECT ${columns} FROM events WHERE id = ?`)
        .bind(row[0])
        .first<Record<string, string | null>>();
      return columns.split(", ").map((column) => stored?.[column] ?? null);
    };
    const id = "https://gdg.community.dev/events/details/all-columns";
    const inserted = [
      id,
      `${id}/`,
      "Title A",
      "Community A",
      "Talk",
      "2026-01-01",
      "2026-01-02",
      "Description A",
      "Location A",
    ];
    expect(await roundTrip(inserted)).toEqual(inserted);
    const updated = [
      id,
      `${id}/`,
      "Title B",
      "Community B",
      "Workshop",
      "2026-02-01",
      "2026-02-03",
      "Description B",
      "Location B",
    ];
    expect(await roundTrip(updated)).toEqual(updated);
  });

  it("rolls back every deactivation when a statement inside the batch fails", async () => {
    serve({ [BBSR]: lists() });
    await seed([["bbsr-batch", "GDG Bhubaneswar"]]);
    await db
      .prepare("INSERT INTO event_source_memberships VALUES (?, 'gdg-bhubaneswar', 1)")
      .bind(eventUrlKey(url("bbsr-batch")))
      .run();
    // The membership deactivation runs first; the injected last statement fails
    // inside the same D1 batch, so the transaction must undo the earlier ones.
    const failingLast: D1 = {
      prepare: db.prepare.bind(db),
      batch: (statements) =>
        db.batch!([...statements, db.prepare("UPDATE missing_table SET x = 1")]),
    };
    await expect(syncEventsToD1(failingLast)).rejects.toThrow(/missing_table/);
    const membership = await db
      .prepare("SELECT is_active FROM event_source_memberships WHERE source_id = 'gdg-bhubaneswar'")
      .first<{ is_active: number }>();
    expect(membership?.is_active).toBe(1);
    expect(await activeBySlug()).toEqual({ "bbsr-batch": 1 });
  });

  it("does not restart the grace window of an already-retired event", async () => {
    await seed([["long-retired", "GDG Bhubaneswar"]]);
    const id = eventUrlKey(url("long-retired"));
    await db
      .prepare(
        "UPDATE events SET is_active = 0, last_seen = datetime('now', '-60 days') WHERE id = ?",
      )
      .bind(id)
      .run();
    await db
      .prepare("INSERT INTO event_source_memberships VALUES (?, 'gdg-bhubaneswar', 0)")
      .bind(id)
      .run();
    serve({});
    await syncEventsToD1(db);
    expect((await readEventsFromD1(db)).map((event) => event.title)).not.toContain("long-retired");
  });

  it("protects rows stored under an organizer alias", async () => {
    serve({
      [BBSR]: lists(list([ev("bbsr-next", "2099-01-01")]), list([], { count: 87 })),
      [KIIT]: 503,
    });
    await seed([
      ["kiit-alias", "GDG on Campus KIIT"],
      ["bbsr-alias-past", "Google Developer Group Bhubaneswar"],
    ]);

    await syncEventsToD1(db);
    expect(await activeBySlug()).toMatchObject({ "kiit-alias": 1, "bbsr-alias-past": 1 });
  });

  it("retires correctly when more than 100 event IDs were seen", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ev(`bulk-${i}`));
    serve({ [BBSR]: lists(list(), list(many)) });
    await seed([["bbsr-gone", "GDG Bhubaneswar"]]);

    await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 150 });
    const active = await activeBySlug();
    expect(active["bbsr-gone"]).toBe(0);
    expect(Object.values(active).filter((v) => v === 1)).toHaveLength(150);
  });
});

describe("persisted measured outcomes and cohosts", () => {
  it("has no fabricated success timestamp when the first measured attempt fails", async () => {
    const { readEventSourceStatuses } = await import("../src/lib/events-store");
    serve({ [BBSR]: 503 });
    await syncEventsToD1(db);
    const firstFailure = (await readEventSourceStatuses(db)).find(
      (status) => status.sourceId === "gdg-bhubaneswar",
    )!;
    expect(firstFailure.outcome).toBe("failed");
    expect(firstFailure.lastSuccessAt).toBeUndefined();
    expect(firstFailure.errorCategory).toBe("http");
  });

  it("keeps last success separate from attempts across repeated failing runs", async () => {
    const { readEventSourceStatuses, readEventsFromD1 } = await import("../src/lib/events-store");
    serve({ [BBSR]: lists(list([ev("known")])), [KIIT]: lists() });
    await syncEventsToD1(db);
    const first = (await readEventSourceStatuses(db)).find(
      (status) => status.sourceId === "gdg-bhubaneswar",
    )!;
    expect(first.outcome).toBe("success-events");
    serve({ [BBSR]: 503 });
    await syncEventsToD1(db);
    await syncEventsToD1(db);
    const failed = (await readEventSourceStatuses(db)).find(
      (status) => status.sourceId === "gdg-bhubaneswar",
    )!;
    expect(failed.outcome).toBe("failed");
    expect(failed.lastSuccessAt).toBe(first.lastSuccessAt);
    expect(Date.parse(failed.lastAttemptAt)).toBeGreaterThanOrEqual(
      Date.parse(first.lastAttemptAt),
    );
    expect((await readEventsFromD1(db)).some((event) => event.title === "known")).toBe(true);
    expect(failed).not.toHaveProperty("verifiedAt");
  });
  it("retains a cohosted event while either known owner is unavailable", async () => {
    serve({ [BBSR]: lists(list([ev("cohost")])), [KIIT]: lists(list([ev("cohost")])) });
    await syncEventsToD1(db);
    serve({ [BBSR]: lists(), [KIIT]: 503 });
    await syncEventsToD1(db);
    expect((await activeBySlug()).cohost).toBe(1);
    serve({ [BBSR]: lists(), [KIIT]: lists() });
    await syncEventsToD1(db);
    expect((await activeBySlug()).cohost).toBe(0);
  });
  it("preserves unknown legacy rows on an authoritative empty refresh", async () => {
    await seed([["unknown", "Unmapped historical organizer"]]);
    serve({});
    await syncEventsToD1(db);
    expect((await activeBySlug()).unknown).toBe(1);
  });
});
