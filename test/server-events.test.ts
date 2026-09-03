import { afterEach, describe, expect, it, vi } from "vitest";
import server from "../src/server";
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
});
