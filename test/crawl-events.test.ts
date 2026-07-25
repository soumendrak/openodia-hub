import { describe, it, expect } from "vitest";
// The crawler is a bun script; it exports its pure helpers and only runs main()
// when executed directly, so importing here is side-effect free.
import {
  inferType,
  normalizeUrl,
  tzDate,
  formatDateRange,
  shouldSkip,
} from "../scripts/crawl-events.mjs";

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
  });

  it("keeps real events", () => {
    expect(shouldSkip("Deploy or Die")).toBe(false);
    expect(shouldSkip("Build with AI: Code for Communities")).toBe(false);
  });
});
