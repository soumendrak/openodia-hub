import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readEventsFromD1,
  RETIRE_SQL,
  syncEventsToD1,
  UPSERT_SQL,
  type D1Like,
} from "../src/lib/events-store";

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
    // syncEventsToD1 only ever sees events produced by fetchChapterSnapshot, and
    // that mapper always sets endDate = startDate and description = "" — so
    // the `?? null` fallbacks can never fire through a real Bevy scrape.
    // Mocking the module boundary simulates a different/future event producer
    // (or a corrupted upstream shape) that legitimately omits these optional
    // `Event` fields, which is exactly what the fallback guards against.
    vi.doMock("../src/routes/api/events", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/routes/api/events")>();
      return {
        ...actual,
        fetchChapterSnapshot: vi.fn(async () => ({
          upcomingComplete: true,
          pastComplete: true,
          events: [
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
          ],
        })),
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

// Semantics of the retirement SQL are tested against a real D1 in
// events-store-d1.test.ts; this fake only records how many values each
// statement binds, which miniflare does not limit.
describe("event persistence bound parameters", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("keeps every statement within D1's 100-bound-parameter limit for large syncs", async () => {
    const urls = Array.from(
      { length: 150 },
      (_, i) => `https://gdg.community.dev/events/details/bulk-${i}`,
    );
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: { results: [], count: 0 },
            pastEvents: {
              results: urls.map((url) => ({ title: url, start_date: "2025-07-15T18:00:00Z", url })),
              count: 150,
            },
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as Response);

    const bound = new Map<string, number>();
    const db: D1Like = {
      prepare(sql) {
        const statement = {
          bind(...values: unknown[]) {
            bound.set(sql, Math.max(bound.get(sql) ?? 0, values.length));
            return statement;
          },
          run: async () => ({}),
          all: async <T>() => ({ results: [] as T[] }),
        };
        return statement;
      },
    };

    await expect(syncEventsToD1(db)).resolves.toEqual({ upserted: 150 });
    expect(bound.get(UPSERT_SQL)).toBe(9);
    expect(bound.get(RETIRE_SQL)).toBeLessThanOrEqual(100);
  });
});
