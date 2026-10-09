// @vitest-environment node
// Runs syncEventsToD1 against a real (miniflare) D1 built from db/schema.sql,
// so the retirement SQL itself is exercised rather than a reimplementation.
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { syncEventsToD1, type D1Like } from "../src/lib/events-store";
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
      "iiit-old": 0,
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
