// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { readEventsFromD1, syncEventsToD1, type D1Like } from "../src/lib/events-store";
import { applyEventOverrides } from "../src/lib/event-lifecycle";
import { persistReviewedEvent } from "../src/lib/event-reviewed-store";
import type { Event } from "../src/data/events/types";
import { events as curated } from "../src/data/events";
import { eventUrlKey } from "../src/lib/event-url";

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
  for (const table of ["events", "event_reviewed_metadata", "event_destination_aliases"])
    await db.prepare(`DELETE FROM ${table}`).run();
  vi.unstubAllGlobals();
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

it("syncs 114 rows within eight JSON-bound D1 queries and retains reviewed alias facts after old-row retirement", async () => {
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
  expect(queries).toBeLessThanOrEqual(8);
  expect(maxParameters).toBe(1);
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
