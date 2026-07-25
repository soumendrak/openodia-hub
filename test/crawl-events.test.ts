import { describe, it, expect } from "vitest";
// The crawler is a bun script; it exports its pure helpers and only runs main()
// when executed directly, so importing here is side-effect free.
import {
  ParseError,
  HttpError,
  detailDescription,
  inferType,
  isFatalCrawlFailure,
  isTransientFetchFailure,
  normalizeUrl,
  parseGDGEventCards,
  tzDate,
  formatDateRange,
  shouldSkip,
} from "../scripts/crawl-events.mjs";

function gdgPage(prerenderData: unknown) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { prerenderData } },
  })}</script>`;
}

describe("inferType", () => {
  it("classifies Deploy or Die as a Hackathon from its description (#6)", () => {
    // Title has no keyword; the description names a hackathon.
    expect(
      inferType(
        "Deploy or Die",
        "a talk worth showing up for, a hackathon worth losing sleep over",
      ),
    ).toBe("Hackathon");
  });

  it("does not let 'ctf' inside 'impactful' win over 'session' (#5)", () => {
    expect(inferType("", "An impactful AI session")).toBe("Talk");
  });

  it("still matches brand concatenations like HackForge / HackFest", () => {
    expect(inferType("HackForge 2.0")).toBe("Hackathon");
    expect(inferType("HackFest Bhubaneswar 2026")).toBe("Hackathon");
  });

  it("does not match keywords as prefixes of unrelated words", () => {
    expect(inferType("Community meetup", "A forgetful facilitator shares lessons")).toBe(
      "Workshop",
    );
    expect(inferType("Community meetup", "A hackneyed example")).toBe("Workshop");
  });

  it("maps DevFest to Conference and defaults to Workshop", () => {
    expect(inferType("DevFest 2025 – Bhubaneswar")).toBe("Conference");
    expect(inferType("Community Meetup")).toBe("Workshop");
  });
});

describe("normalizeUrl", () => {
  it("strips the /cohost-… segment and trailing slash", () => {
    const base = "https://gdg.community.dev/events/details/x-presents-hackforge-20";
    expect(normalizeUrl(`${base}/`)).toBe(base);
    expect(normalizeUrl(`${base}/cohost-gdg-bhubaneswar`)).toBe(base);
  });
});

describe("tzDate (#3)", () => {
  it("resolves an evening-UTC instant to the correct IST calendar date", () => {
    // 2026-08-07T19:00Z is Aug 8 in India, not Aug 7.
    const d = tzDate("2026-08-07T19:00:00Z", "Asia/Kolkata");
    expect(d?.iso).toBe("2026-08-08");
    expect(d?.display).toBe("8 Aug 2026");
  });
});

describe("formatDateRange", () => {
  it("renders a same-month multi-day span (#2)", () => {
    const start = tzDate("2026-08-08T03:30:00Z", "Asia/Kolkata");
    const end = tzDate("2026-08-09T07:30:00Z", "Asia/Kolkata");
    expect(formatDateRange(start, end)).toBe("8–9 Aug 2026");
  });

  it("collapses to a single day when start == end", () => {
    const d = tzDate("2026-08-08T03:30:00Z", "Asia/Kolkata");
    expect(formatDateRange(d, d)).toBe("8 Aug 2026");
  });
});

describe("shouldSkip (#4)", () => {
  it("skips orientation/planning admin events", () => {
    expect(
      shouldSkip("GDG On Campus IIIT Bhubaneswar Info Session + D3 Fest Planning Session"),
    ).toBe(true);
    expect(shouldSkip("New Member Orientation")).toBe(true);
    expect(shouldSkip("GDG Info Session")).toBe(true);
  });

  it("keeps real and substantively technical events", () => {
    expect(shouldSkip("Deploy or Die")).toBe(false);
    expect(shouldSkip("Build with AI: Code for Communities")).toBe(false);
    expect(shouldSkip("AI Product Planning Session")).toBe(false);
    expect(
      shouldSkip(
        "Gemini API Info Session",
        "Bring your laptop for a hands-on lab where we build an AI application.",
      ),
    ).toBe(false);
  });
});

describe("parseGDGEventCards", () => {
  it("accepts a structurally valid empty chapter", () => {
    expect(
      parseGDGEventCards(
        gdgPage({
          upcomingEvents: { results: [] },
          pastEvents: { results: [] },
        }),
      ),
    ).toEqual([]);
  });

  it("throws ParseError when a results array disappears", () => {
    expect(() =>
      parseGDGEventCards(
        gdgPage({
          upcomingEvents: {},
          pastEvents: { results: [] },
        }),
      ),
    ).toThrow(ParseError);
  });

  it("throws ParseError instead of filtering malformed event records", () => {
    expect(() =>
      parseGDGEventCards(
        gdgPage({
          upcomingEvents: { results: [{ title: "Missing URL" }] },
          pastEvents: { results: [] },
        }),
      ),
    ).toThrow(ParseError);
    expect(() =>
      parseGDGEventCards(
        gdgPage({
          upcomingEvents: {
            results: [
              {
                title: "Cohost URL without canonical detail URL",
                cohost_registration_url: "https://example.com/cohost",
              },
            ],
          },
          pastEvents: { results: [] },
        }),
      ),
    ).toThrow(ParseError);
  });
});

describe("fetch failure classification", () => {
  it("fails permanently for non-retryable responses from configured sources", () => {
    expect(isTransientFetchFailure(new HttpError(404, "https://example.com/source", true))).toBe(
      false,
    );
    expect(isTransientFetchFailure(new HttpError(410, "https://example.com/source", true))).toBe(
      false,
    );
  });

  it("keeps network, detail/asset, throttling, and server failures transient", () => {
    expect(isTransientFetchFailure(new Error("socket timeout"))).toBe(true);
    expect(isTransientFetchFailure(new HttpError(404, "https://example.com/detail"))).toBe(true);
    expect(isTransientFetchFailure(new HttpError(429, "https://example.com/source", true))).toBe(
      true,
    );
    expect(isTransientFetchFailure(new HttpError(503, "https://example.com/source", true))).toBe(
      true,
    );
  });

  it("makes parser and permanent HTTP failures fatal to the crawl", () => {
    expect(isFatalCrawlFailure(new ParseError("schema moved"))).toBe(true);
    expect(isFatalCrawlFailure(new HttpError(404, "https://example.com/source", true))).toBe(true);
    expect(isFatalCrawlFailure(new Error("socket timeout"))).toBe(false);
  });
});

describe("detailDescription", () => {
  it("uses and sanitizes the full detail description when the short field is truncated", () => {
    expect(
      detailDescription({
        description_short: "A useful event for dev...",
        description:
          "<p>A useful event for developers &amp; designers.</p><p>Bring your laptop.</p><p>This third sentence is omitted.</p>",
      }),
    ).toBe("A useful event for developers & designers. Bring your laptop.");
  });

  it("keeps a complete short description", () => {
    expect(
      detailDescription({
        description_short: "A concise complete description.",
        description: "<p>A much longer description.</p>",
      }),
    ).toBe("A concise complete description.");
  });
});
