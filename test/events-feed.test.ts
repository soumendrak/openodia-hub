/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Route } from "../src/routes/events-feed";

describe("events-feed handler", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("successfully generates compliant RSS 2.0 XML with merged events", async () => {
    // Mock fetch for dynamic events so it doesn't do real networking in unit tests
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(`
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "prerenderData": {
                    "upcomingEvents": {
                      "results": [
                        {
                          "title": "GDG Tech Talk Test Event",
                          "description": "A talk about GDG.",
                          "event_type_title": "Talk",
                          "start_date": "2026-07-15T18:00:00Z",
                          "url": "https://gdg.community.dev/events/details/tech-talk-test"
                        }
                      ]
                    }
                  }
                }
              }
            }
          </script>
        `),
      } as Response),
    );

    const getHandler = Route.options.server?.handlers?.GET;
    expect(getHandler).toBeDefined();

    if (getHandler) {
      const response = await getHandler({} as any);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");

      const xmlText = await response.text();

      // Basic RSS structure checks
      expect(xmlText).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlText).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
      expect(xmlText).toContain("<channel>");
      expect(xmlText).toContain("<title>Odia AI Community Events</title>");
      expect(xmlText).toContain("<link>https://openodia.com/events</link>");
      expect(xmlText).toContain(
        '<atom:link href="https://openodia.com/events-feed" rel="self" type="application/rss+xml" />',
      );

      // Check that it contains items
      expect(xmlText).toContain("<item>");
      expect(xmlText).toContain("</item>");

      // Check dynamic event is present and merged correctly
      expect(xmlText).toContain("<title>GDG Tech Talk Test Event</title>");
      expect(xmlText).toContain(
        "<link>https://gdg.community.dev/events/details/tech-talk-test</link>",
      );
      expect(xmlText).toContain("<![CDATA[");
      expect(xmlText).toContain("<strong>Organized by:</strong> GDG Bhubaneswar");
    }
  });

  it("handles fetch errors gracefully and falls back to static events only", async () => {
    // Mock fetch failure
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response),
    );

    const getHandler = Route.options.server?.handlers?.GET;
    expect(getHandler).toBeDefined();

    if (getHandler) {
      const response = await getHandler({} as any);
      expect(response.status).toBe(200);

      const xmlText = await response.text();
      // Should still generate feed using static events
      expect(xmlText).toContain("<title>Odia AI Community Events</title>");
      expect(xmlText).toContain("<item>");
    }
  });
});
