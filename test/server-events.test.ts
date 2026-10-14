import { afterEach, describe, expect, it, vi } from "vitest";
import server from "../src/server";
import { events as curated } from "../src/data/events";
import type { D1Like } from "../src/lib/events-store";

describe("production events endpoint", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("removes a stale renamed event row returned by D1", async () => {
    const current =
      "https://gdg.community.dev/events/details/google-gdg-cloud-bhubaneswar-presents-code-for-communities-20/";
    const legacy =
      "https://gdg.community.dev/events/details/google-gdg-cloud-bhubaneswar-presents-learn-with-communities-bhubaneswar-2026/cohost-gdg-bhubaneswar";
    const rows = [
      {
        url: legacy,
        title: "Learn with Communities Bhubaneswar 2026",
        community: "GDG Bhubaneswar",
        type: "Talk",
        start_date: "2026-09-13",
        end_date: "2026-09-13",
        description: "Old title.",
        location: null,
      },
      {
        url: current,
        title: "Code for Communities 2.0",
        community: "GDG Bhubaneswar",
        type: "Hackathon",
        start_date: "2026-09-13",
        end_date: "2026-09-13",
        description: "Current title.",
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

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return { ok: true, url: url === legacy ? current : url } as Response;
    }) as typeof fetch;

    const response = await server.fetch(
      new Request("https://openodia.com/api/events?verify=production-d1"),
      { EVENTS_DB: db },
      {},
    );
    const payload = (await response.json()) as {
      events: Array<{ title: string; url: string; startDate: string }>;
      source: string;
    };

    expect(payload.source).toBe("d1");
    expect(payload.events.filter((event) => event.startDate === "2026-09-13")).toEqual([
      expect.objectContaining({ title: "Code for Communities 2.0", url: current }),
    ]);
  });
  it("does not resolve the curated archive before first-page pagination", async () => {
    const event = curated.find((event) => event.startDate)!;
    const db: D1Like = {
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => ({
            results: (sql.includes("SELECT url")
              ? [
                  {
                    url: "https://example.com/persisted-single-row",
                    title: "Persisted event",
                    community: event.community,
                    type: "Talk",
                    start_date: event.startDate,
                    end_date: null,
                    description: "",
                    location: null,
                  },
                ]
              : []) as T[],
          }),
        };
      },
    };
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=1&limit=1"),
      { EVENTS_DB: db },
      {},
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toHaveLength(1);
    expect(body.years).toEqual(
      expect.arrayContaining([...new Set(curated.map((event) => event.year))]),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
