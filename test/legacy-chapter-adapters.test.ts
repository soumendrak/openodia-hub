import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, Route as EventApiRoute, type EventChapter } from "../src/routes/api/events";
import { Route as FeedRoute } from "../src/routes/events-feed";
import { syncEventsToD1, type D1Like } from "../src/lib/events-store";

// EventChapter deliberately keeps organizerId optional for existing injected adapters.
// Exercise that supported boundary using the real parser, rather than mocking fetch signatures.
const configuredChapters = [...CHAPTERS];
const legacySlug = "legacy-chapter-contract";
const canonicalUrl = "https://example.com/legacy-chapter-contract";
const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: { upcomingEvents: { results: [{ title: "Legacy chapter adapter event", description: "An organizer alias from an older adapter.", event_type_title: "Talk", start_date: "2026-11-12T10:00:00Z", url: canonicalUrl }] }, pastEvents: { results: [] } } } } })}</script>`;
const mutableChapters = CHAPTERS as EventChapter[];
const apiGet = (
  EventApiRoute as unknown as {
    options: { server: { handlers: { GET: (input: { request: Request }) => Promise<Response> } } };
  }
).options.server.handlers.GET;
const feedGet = (
  FeedRoute as unknown as { options: { server: { handlers: { GET: () => Promise<Response> } } } }
).options.server.handlers.GET;
beforeEach(() => {
  mutableChapters.splice(0, mutableChapters.length, { community: "TFUG BBSR", slug: legacySlug });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(page, { status: 200 })),
  );
});
afterEach(() => {
  mutableChapters.splice(0, mutableChapters.length, ...configuredChapters);
  vi.unstubAllGlobals();
});
describe("legacy chapter adapter compatibility", () => {
  it("uses the legacy community alias when a direct event API adapter has no organizerId", async () => {
    const response = await apiGet({ request: new Request("https://openodia.com/api/events") });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      events: { url: string; community: string; organizerId?: string }[];
    };
    expect(body.events).toContainEqual(
      expect.objectContaining({
        url: canonicalUrl,
        community: "TFUG Bhubaneswar",
        organizerId: "tfug-bbsr",
      }),
    );
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(legacySlug), expect.any(Object));
  });
  it("resolves the legacy organizer alias in RSS rather than dropping its events", async () => {
    const response = await feedGet();
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<strong>Organized by:</strong> TFUG Bhubaneswar");
  });
  it("persists events produced by an adapter that only supplies the legacy community name", async () => {
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
    const inserted = JSON.parse(
      calls.find((call) => call.sql.includes("INSERT INTO events"))!.values[0] as string,
    );
    expect(inserted[0]).toMatchObject({ community: "TFUG Bhubaneswar", url: canonicalUrl });
  });
});
