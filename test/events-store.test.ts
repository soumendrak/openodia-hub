import { afterEach, describe, expect, it, vi } from "vitest";
import { readEventsFromD1, syncEventsToD1, type D1Like } from "../src/lib/events-store";
import { eventUrlKey } from "../src/lib/event-url";

function eventPage(baseUrl: string): string {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: {
            results: [
              {
                title: "Shared event",
                description: "A shared GDG event.",
                event_type_title: "Talk",
                start_date: "2026-07-15T18:00:00Z",
                url: baseUrl,
                cohost_registration_url: `${baseUrl}/cohost-gdg-bhubaneswar`,
              },
            ],
          },
          pastEvents: { results: [] },
        },
      },
    },
  })}</script>`;
}

describe("event persistence URL deduplication", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("upserts one canonical D1 row when several chapters expose the same destination", async () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(eventPage(base)),
    } as Response);

    const calls: { sql: string; values: unknown[] }[] = [];
    const db: D1Like = {
      prepare(sql) {
        const statement = {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return statement;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: [] as T[] }),
        };
        return statement;
      },
    };

    await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 1 });
    const insert = calls.find((call) => call.sql.includes("INSERT INTO events"));
    expect(insert?.values[0]).toBe(base);
  });

  it("hides legacy duplicate rows immediately when reading D1", async () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    const rows = ["bhubaneswar", "kiit"].map((chapter) => ({
      url: `${base}/cohost-gdg-${chapter}`,
      title: "Shared event",
      community: `GDG ${chapter}`,
      type: "Talk",
      start_date: "2026-07-15",
      end_date: null,
      description: null,
      location: null,
    }));
    const db: D1Like = {
      prepare() {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: rows as T[] }),
        };
      },
    };

    const events = await readEventsFromD1(db);
    expect(events).toHaveLength(1);
    expect(events[0]?.url).toBe(`${base}/cohost-gdg-bhubaneswar`);
    expect(events[0]?.community).toBe("GDG bhubaneswar");
    expect(events[0]?.organizerId).toBe("gdg-bhubaneswar");
  });

  it("preserves an unresolved legacy community without inventing an organizer ID", async () => {
    const rows = [
      {
        url: "https://example.com/legacy-event",
        title: "Legacy event",
        community: "Unreviewed legacy group",
        type: "Talk",
        start_date: "2026-07-15",
        end_date: null,
        description: null,
        location: null,
      },
    ];
    const db: D1Like = {
      prepare() {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: rows as T[] }),
        };
      },
    };

    const [event] = await readEventsFromD1(db);
    expect(event?.community).toBe("Unreviewed legacy group");
    expect(event?.organizerId).toBeUndefined();
  });

  it("skips upserting events that are missing a url or a start date", async () => {
    const withGaps = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: {
              results: [
                {
                  title: "Missing url",
                  description: "No destination address.",
                  event_type_title: "Talk",
                  start_date: "2026-07-15T18:00:00Z",
                  url: "",
                },
                {
                  title: "Missing start date",
                  description: "No date.",
                  event_type_title: "Talk",
                  start_date: "",
                  url: "https://gdg.community.dev/events/details/missing-date",
                },
              ],
            },
            pastEvents: { results: [] },
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(withGaps),
    } as Response);

    const calls: { sql: string; values: unknown[] }[] = [];
    const db: D1Like = {
      prepare(sql) {
        const statement = {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return statement;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: [] as T[] }),
        };
        return statement;
      },
    };

    await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 0 });
    expect(calls.some((call) => call.sql.includes("INSERT INTO events"))).toBe(false);
  });

  it("binds null for endDate and description when an upstream event omits them", async () => {
    // syncEventsToD1 only ever sees events produced by fetchChapterEventsOrThrow, and
    // that mapper always sets endDate = startDate and description = "" — so
    // the `?? null` fallbacks can never fire through a real Bevy scrape.
    // Mocking the module boundary simulates a different/future event producer
    // (or a corrupted upstream shape) that legitimately omits these optional
    // `Event` fields, which is exactly what the fallback guards against.
    vi.doMock("../src/routes/api/events", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/routes/api/events")>();
      return {
        ...actual,
        fetchChapterEventsOrThrow: vi.fn(async () => [
          {
            year: "2026",
            date: "1 Jul 2026",
            title: "Bare event",
            url: "https://gdg.community.dev/events/details/bare-event",
            type: "Talk",
            community: "GDG Bhubaneswar",
            startDate: "2026-07-01",
            // endDate and description intentionally omitted.
          },
        ]),
      };
    });

    vi.resetModules();
    const { syncEventsToD1: syncWithMockedSource } = await import("../src/lib/events-store");

    const calls: { sql: string; values: unknown[] }[] = [];
    const db: D1Like = {
      prepare(sql) {
        const statement = {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return statement;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: [] as T[] }),
        };
        return statement;
      },
    };

    await expect(syncWithMockedSource(db)).resolves.toEqual({ upserted: 1 });
    const insert = calls.find((call) => call.sql.includes("INSERT INTO events"));
    // bind order: id, url, title, community, type, startDate, endDate, description, location
    expect(insert?.values[6]).toBeNull();
    expect(insert?.values[7]).toBeNull();

    vi.doUnmock("../src/routes/api/events");
    vi.resetModules();
  });
});

type StoredRow = { id: string; community: string; source: string; is_active: number };

// Applies the upsert and retirement statements to in-memory rows. Retirement
// binds two JSON arrays: the communities in scope, then the seen IDs.
function inMemoryD1(rows: StoredRow[]): D1Like {
  return {
    prepare(sql) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        run: async () => {
          if (sql.includes("INSERT INTO events")) {
            const [id, , , community] = values as string[];
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, { community, is_active: 1 });
            else rows.push({ id, community, source: "bevy", is_active: 1 });
          } else if (sql.includes("UPDATE events SET is_active = 0")) {
            const [communities, seenIds] = values.map((v) => JSON.parse(v as string) as string[]);
            for (const r of rows) {
              if (r.source !== "bevy" || seenIds.includes(r.id)) continue;
              if (communities.includes(r.community)) r.is_active = 0;
            }
          } else {
            throw new Error(`unexpected SQL: ${sql}`);
          }
          return {};
        },
        all: async <T>() => ({ results: [] as T[] }),
      };
      return statement;
    },
  };
}

describe("event persistence with mixed source outcomes", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("never retires rows because a chapter fetch failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listed = "https://gdg.community.dev/events/details/bbsr-listed";
    const emptyPage = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: { upcomingEvents: { results: [] }, pastEvents: { results: [] } },
        },
      },
    })}</script>`;
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("kalinga-institute")) {
        return { ok: false, status: 503, text: async () => "" } as Response;
      }
      if (url.includes("c-v-raman")) throw new Error("network timeout");
      const html = url.endsWith("/gdg-bhubaneswar/") ? eventPage(listed) : emptyPage;
      return { ok: true, status: 200, text: async () => html } as Response;
    }) as typeof fetch;

    const row = (url: string, community: string, source = "bevy"): StoredRow => ({
      id: eventUrlKey(url),
      community,
      source,
      is_active: 1,
    });
    const rows = [
      row(listed, "GDG Bhubaneswar"),
      row("https://gdg.community.dev/events/details/bbsr-gone", "GDG Bhubaneswar"),
      row("https://gdg.community.dev/events/details/kiit-1", "GDGoC KIIT"),
      row("https://gdg.community.dev/events/details/kiit-2", "GDGoC KIIT"),
      row("https://gdg.community.dev/events/details/cvr-1", "GDGoC CVR University"),
      row("https://example.com/static-event", "GDGoC KIIT", "static"),
    ];

    await expect(syncEventsToD1(inMemoryD1(rows))).resolves.toEqual({ upserted: 1 });

    const active = Object.fromEntries(rows.map((r) => [r.id, r.is_active]));
    expect(active).toEqual({
      [eventUrlKey(listed)]: 1,
      // The successful chapter still retires its own missing event.
      [eventUrlKey("https://gdg.community.dev/events/details/bbsr-gone")]: 0,
      // Failed chapters (HTTP 503 and a thrown network error) keep their rows.
      [eventUrlKey("https://gdg.community.dev/events/details/kiit-1")]: 1,
      [eventUrlKey("https://gdg.community.dev/events/details/kiit-2")]: 1,
      [eventUrlKey("https://gdg.community.dev/events/details/cvr-1")]: 1,
      [eventUrlKey("https://example.com/static-event")]: 1,
    });
  });

  it("does not treat a page without its event lists as a successful empty chapter", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listed = "https://gdg.community.dev/events/details/bbsr-listed";
    // prerenderData is present but both result lists were renamed upstream.
    const reshapedPage = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { prerenderData: { upcoming: [], past: [] } } },
    })}</script>`;
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const html = String(input).endsWith("/gdg-bhubaneswar/") ? eventPage(listed) : reshapedPage;
      return { ok: true, status: 200, text: async () => html } as Response;
    }) as typeof fetch;

    const kiit = "https://gdg.community.dev/events/details/kiit-1";
    const rows: StoredRow[] = [
      { id: eventUrlKey(listed), community: "GDG Bhubaneswar", source: "bevy", is_active: 1 },
      { id: eventUrlKey(kiit), community: "GDGoC KIIT", source: "bevy", is_active: 1 },
    ];

    await expect(syncEventsToD1(inMemoryD1(rows))).resolves.toEqual({ upserted: 1 });
    expect(rows.map((r) => r.is_active)).toEqual([1, 1]);
  });

  it("keeps the retirement query within D1's bound-parameter limit for large syncs", async () => {
    const urls = Array.from(
      { length: 150 },
      (_, i) => `https://gdg.community.dev/events/details/bulk-${i}`,
    );
    const page = (results: unknown[]) =>
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            prerenderData: { upcomingEvents: { results }, pastEvents: { results: [] } },
          },
        },
      })}</script>`;
    const bulk = page(urls.map((url) => ({ title: url, start_date: "2026-07-15T18:00:00Z", url })));
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const html = String(input).endsWith("/gdg-bhubaneswar/") ? bulk : page([]);
      return { ok: true, status: 200, text: async () => html } as Response;
    }) as typeof fetch;

    const gone = "https://gdg.community.dev/events/details/bbsr-gone";
    const rows: StoredRow[] = [
      { id: eventUrlKey(gone), community: "GDG Bhubaneswar", source: "bevy", is_active: 1 },
    ];
    const db = inMemoryD1(rows);
    const bindCounts: number[] = [];
    const counted: D1Like = {
      prepare(sql) {
        const statement = db.prepare(sql);
        const bind = statement.bind.bind(statement);
        statement.bind = (...values: unknown[]) => {
          bindCounts.push(values.length);
          return bind(...values);
        };
        return statement;
      },
    };

    await expect(syncEventsToD1(counted)).resolves.toEqual({ upserted: 150 });
    expect(Math.max(...bindCounts)).toBeLessThanOrEqual(100);
    expect(rows.find((r) => r.id === eventUrlKey(gone))?.is_active).toBe(0);
    expect(rows.filter((r) => r.is_active === 1)).toHaveLength(150);
  });
});
