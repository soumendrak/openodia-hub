import { describe, expect, it } from "vitest";

import {
  HttpError,
  ParseError,
  detailDescription,
  formatDateRange,
  htmlToText,
  inferType,
  isFatalCrawlFailure,
  isTransientFetchFailure,
  parseDate,
  parseGDGEventCards,
  shouldSkip,
  tzDate,
} from "../scripts/crawl-events.mjs";

const nextDataHtml = (payload: unknown) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;

describe("crawl-events pure helper functions", () => {
  describe("isTransientFetchFailure / isFatalCrawlFailure", () => {
    it("treats non-HttpError failures (network errors) as transient", () => {
      expect(isTransientFetchFailure(new Error("network down"))).toBe(true);
    });

    it("treats retryable HTTP statuses as transient regardless of source", () => {
      expect(isTransientFetchFailure(new HttpError(429, "https://x", true))).toBe(true);
      expect(isTransientFetchFailure(new HttpError(503, "https://x", true))).toBe(true);
    });

    it("treats a non-retryable status on an unconfigured source as transient", () => {
      expect(isTransientFetchFailure(new HttpError(404, "https://x", false))).toBe(true);
    });

    it("treats a non-retryable status on a configured source as permanent", () => {
      expect(isTransientFetchFailure(new HttpError(404, "https://x", true))).toBe(false);
    });

    it("classifies ParseError and permanent fetch failures as fatal", () => {
      expect(isFatalCrawlFailure(new ParseError("bad shape"))).toBe(true);
      expect(isFatalCrawlFailure(new HttpError(404, "https://x", true))).toBe(true);
      expect(isFatalCrawlFailure(new HttpError(404, "https://x", false))).toBe(false);
    });
  });

  describe("inferType", () => {
    it("recognizes concatenated hack-brand titles as Hackathon", () => {
      expect(inferType("HackForge 2026", "")).toBe("Hackathon");
      expect(inferType("Annual HackFest", "")).toBe("Hackathon");
    });

    it("falls back to Workshop when nothing matches", () => {
      expect(inferType("Community meetup", "A casual get-together.")).toBe("Workshop");
    });
  });

  describe("shouldSkip", () => {
    it("skips internal organizer/committee planning events", () => {
      expect(shouldSkip("Organizer planning session", "Internal admin only.")).toBe(true);
    });
  });

  describe("tzDate", () => {
    it("returns null for an unparsable ISO instant", () => {
      expect(tzDate("not-a-valid-date")).toBeNull();
    });
  });

  describe("parseDate", () => {
    it("returns null for an empty or undefined date string", () => {
      expect(parseDate("")).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });
  });

  describe("formatDateRange", () => {
    it("returns null when there is no start date", () => {
      expect(formatDateRange(null, null)).toBeNull();
    });

    it("returns just the start display when there is no end date", () => {
      expect(formatDateRange({ iso: "2026-01-05", display: "5 Jan 2026" }, null)).toBe(
        "5 Jan 2026",
      );
    });

    it("returns just the start display when start and end share the same day", () => {
      const day = { iso: "2026-01-05", display: "5 Jan 2026" };
      expect(formatDateRange(day, { ...day })).toBe("5 Jan 2026");
    });

    it("joins both displays when the range spans a month boundary", () => {
      const start = { iso: "2026-08-30", display: "30 Aug 2026" };
      const end = { iso: "2026-09-01", display: "1 Sep 2026" };
      expect(formatDateRange(start, end)).toBe("30 Aug 2026 – 1 Sep 2026");
    });
  });

  describe("htmlToText", () => {
    it("decodes decimal and hexadecimal numeric character references", () => {
      expect(htmlToText("Caf&#233;")).toBe("Café");
      expect(htmlToText("Caf&#xe9;")).toBe("Café");
    });

    it("decodes known named entities and leaves unknown ones intact", () => {
      expect(htmlToText("Tom &amp; Jerry")).toBe("Tom & Jerry");
      expect(htmlToText("A&foo;B")).toBe("A&foo;B");
    });
  });

  describe("detailDescription", () => {
    it("returns the short description when there is no full description", () => {
      expect(
        detailDescription({ description_short: "Full short description.", description: "" }),
      ).toBe("Full short description.");
    });

    it("returns null when neither description is present", () => {
      expect(detailDescription({})).toBeNull();
    });
  });

  describe("parseGDGEventCards", () => {
    it("throws when the embedded JSON is malformed", () => {
      expect(() =>
        parseGDGEventCards(
          '<script id="__NEXT_DATA__" type="application/json">{not valid json}</script>',
        ),
      ).toThrow(ParseError);
    });

    it("throws when prerenderData is missing", () => {
      expect(() => parseGDGEventCards(nextDataHtml({ props: { pageProps: {} } }))).toThrow(
        ParseError,
      );
    });

    it("throws when a results array is missing", () => {
      expect(() =>
        parseGDGEventCards(
          nextDataHtml({
            props: {
              pageProps: { prerenderData: { upcomingEvents: { results: [] } } },
            },
          }),
        ),
      ).toThrow(ParseError);
    });

    it("throws when a results field is present but not an array", () => {
      expect(() =>
        parseGDGEventCards(
          nextDataHtml({
            props: {
              pageProps: {
                prerenderData: {
                  upcomingEvents: { results: [] },
                  pastEvents: { results: "oops" },
                },
              },
            },
          }),
        ),
      ).toThrow(ParseError);
    });

    it("throws when an event result is missing its title", () => {
      expect(() =>
        parseGDGEventCards(
          nextDataHtml({
            props: {
              pageProps: {
                prerenderData: {
                  upcomingEvents: { results: [{ url: "https://x", title: "" }] },
                  pastEvents: { results: [] },
                },
              },
            },
          }),
        ),
      ).toThrow(ParseError);
    });

    it("throws when cohost_registration_url is present but not a string", () => {
      expect(() =>
        parseGDGEventCards(
          nextDataHtml({
            props: {
              pageProps: {
                prerenderData: {
                  upcomingEvents: {
                    results: [
                      {
                        title: "Weird Cohost Event",
                        url: "https://gdg.community.dev/events/details/weird/",
                        cohost_registration_url: 12345,
                      },
                    ],
                  },
                  pastEvents: { results: [] },
                },
              },
            },
          }),
        ),
      ).toThrow(ParseError);
    });

    it("defaults optional fields when start_date and description_short are absent", () => {
      const [event] = parseGDGEventCards(
        nextDataHtml({
          props: {
            pageProps: {
              prerenderData: {
                upcomingEvents: {
                  results: [
                    {
                      title: "Minimal Event",
                      url: "https://gdg.community.dev/events/details/minimal/",
                    },
                  ],
                },
                pastEvents: { results: [] },
              },
            },
          },
        }),
      );
      expect(event).toMatchObject({
        title: "Minimal Event",
        dateRaw: null,
        description: null,
      });
      expect(event.year).toBeUndefined();
      expect(event.iso).toBeUndefined();
    });
  });
});
