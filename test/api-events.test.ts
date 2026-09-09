import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchChapterEvents, Route } from "../src/routes/api/events";

describe("fetchChapterEvents", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("successfully parses upcoming and past events from the NEXT_DATA script block", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "prerenderData": {
                    "upcomingEvents": {
                      "results": [
                        {
                          "title": "ODIA Generative AI Hackathon",
                          "description": "The ultimate GenAI hackathon.",
                          "event_type_title": "Hackathon",
                          "start_date": "2026-06-25T10:00:00Z",
                          "url": "https://gdg.community.dev/events/details/hackathon-2026"
                        }
                      ]
                    },
                    "pastEvents": {
                      "results": [
                        {
                          "title": "Intro to LLMs Talk",
                          "description_short": "An awesome talk about LLMs.",
                          "description": "Full description here...",
                          "event_type_title": "Workshop",
                          "start_date": "2026-04-10T14:30:00Z",
                          "url": "https://gdg.community.dev/events/details/intro-llm-talk"
                        }
                      ]
                    }
                  }
                }
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtml),
      } as Response),
    );

    const events = await fetchChapterEvents("GDG Bhubaneswar", "gdg-bhubaneswar");

    // We expect fetch to be called with the correct URL
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://gdg.community.dev/gdg-bhubaneswar/",
      expect.any(Object),
    );

    // Two events should be extracted and mapped
    expect(events).toHaveLength(2);

    // Assert mapping for upcoming event
    const upcoming = events.find((e) => e.title === "ODIA Generative AI Hackathon");
    expect(upcoming).toBeDefined();
    expect(upcoming?.year).toBe("2026");
    expect(upcoming?.type).toBe("Hackathon");
    expect(upcoming?.community).toBe("GDG Bhubaneswar");
    expect(upcoming?.url).toBe("https://gdg.community.dev/events/details/hackathon-2026");
    expect(upcoming?.startDate).toBe("2026-06-25");
    expect(upcoming?.description).toBe("The ultimate GenAI hackathon.");

    // Assert mapping for past event
    const past = events.find((e) => e.title === "Intro to LLMs Talk");
    expect(past).toBeDefined();
    expect(past?.year).toBe("2026");
    // Workshop in Bevy event_type_title matches "Workshop" EventType in our map
    expect(past?.type).toBe("Workshop");
    expect(past?.community).toBe("GDG Bhubaneswar");
    expect(past?.url).toBe("https://gdg.community.dev/events/details/intro-llm-talk");
    expect(past?.startDate).toBe("2026-04-10");
    // description_short is preferred
    expect(past?.description).toBe("An awesome talk about LLMs.");
  });

  it("deduplicates repeated and cohosted versions by destination URL", async () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    const mockHtml = `
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            prerenderData: {
              upcomingEvents: {
                results: [
                  {
                    title: "Shared event",
                    description: "First iteration",
                    event_type_title: "Talk",
                    start_date: "2026-07-15T18:00:00Z",
                    url: base,
                    cohost_registration_url: `${base}/cohost-gdg-bhubaneswar`,
                  },
                ],
              },
              pastEvents: {
                results: [
                  {
                    title: "Shared event edited",
                    description: "Second iteration",
                    event_type_title: "Talk",
                    start_date: "2026-07-15T18:00:00Z",
                    url: base,
                    cohost_registration_url: `${base}/cohost-gdg-kiit/`,
                  },
                ],
              },
            },
          },
        },
      })}</script>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockHtml),
    } as Response);

    const events = await fetchChapterEvents("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Shared event");
    expect(events[0]?.url).toBe(base);
  });

  it("handles missing NEXT_DATA script gracefully", async () => {
    const mockHtmlWithoutScript = `
      <!DOCTYPE html>
      <html>
        <body>No events data here.</body>
      </html>
    `;

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtmlWithoutScript),
      } as Response),
    );

    const events = await fetchChapterEvents("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(events).toEqual([]);
  });

  it("handles network failure or non-OK response gracefully", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response),
    );

    const events = await fetchChapterEvents("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(events).toEqual([]);
  });

  it("handles malformed JSON in NEXT_DATA block gracefully", async () => {
    const mockHtmlMalformed = `
      <!DOCTYPE html>
      <html>
        <head>
          <script id="__NEXT_DATA__" type="application/json">
            { malformed json
          </script>
        </head>
      </html>
    `;

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtmlMalformed),
      } as Response),
    );

    const events = await fetchChapterEvents("GDG Bhubaneswar", "gdg-bhubaneswar");
    expect(events).toEqual([]);
  });

  it("maps all Bevy type labels and missing dates", async () => {
    const labels = ["Conference", "AI Summit", "Study Jam", "Speaker session", "Research", "Other"];
    const mockHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: {
              results: labels.map((event_type_title, index) => ({
                title: `Event ${index}`,
                description: "",
                event_type_title,
                start_date: index === 5 ? "" : "2026-01-02T00:00:00Z",
                url: `https://gdg.community.dev/events/details/event-${index}`,
              })),
            },
            pastEvents: {},
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => mockHtml,
    } as Response);
    const events = await fetchChapterEvents("Community", "chapter");
    expect(events.map((event) => event.type)).toEqual([
      "Conference",
      "Conference",
      "Workshop",
      "Talk",
      "Research",
      "Talk",
    ]);
    expect(events[5]?.date).toBe("");
  });

  it("serves complete and paginated live event payloads", async () => {
    const mockHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: {
              results: Array.from({ length: 3 }, (_, index) => ({
                title: `Event ${index}`,
                description: "Description",
                event_type_title: "Talk",
                start_date: "2026-01-02T00:00:00Z",
                url: `https://gdg.community.dev/events/details/event-${index}`,
              })),
            },
            pastEvents: { results: [] },
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => mockHtml } as Response);
    const get = (
      Route.options as unknown as {
        server: { handlers: { GET: (input: { request: Request }) => Promise<Response> } };
      }
    ).server.handlers.GET;
    const complete = await get({ request: new Request("https://openodia.com/api/events") });
    expect(await complete.json()).toMatchObject({ events: expect.any(Array) });
    expect(complete.headers.get("access-control-allow-origin")).toBe("*");

    const paged = await get({
      request: new Request("https://openodia.com/api/events?page=1&limit=2"),
    });
    expect(await paged.json()).toMatchObject({
      events: expect.any(Array),
      nextCursor: "2",
      total: 3,
    });
    const defaulted = await get({
      request: new Request("https://openodia.com/api/events?page=nope&limit=500"),
    });
    expect((await defaulted.json()).nextCursor).toBeUndefined();
  });
});
