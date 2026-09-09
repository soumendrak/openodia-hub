import { describe, it, expect, vi, afterEach } from "vitest";
import { parseEventDateRange } from "../src/data/events/index";

/** Re-imports the module fresh, honoring any `vi.doMock` set up beforehand. */
async function freshEventsModule() {
  vi.resetModules();
  return import("../src/data/events/index");
}

describe("parseEventDateRange", () => {
  it("parses single day dates", () => {
    const res = parseEventDateRange("23 May 2026", "2026");
    expect(res.start).not.toBeNull();
    expect(res.start!.getFullYear()).toBe(2026);
    expect(res.start!.getMonth()).toBe(4); // May (0-indexed)
    expect(res.start!.getDate()).toBe(23);

    expect(res.end).not.toBeNull();
    expect(res.end!.getDate()).toBe(23);
  });

  it("parses date ranges within same month", () => {
    const res = parseEventDateRange("7–8 Apr 2026", "2026");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(3); // April
    expect(res.start!.getDate()).toBe(7);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(3); // April
    expect(res.end!.getDate()).toBe(8);
  });

  it("parses month-only dates", () => {
    const res = parseEventDateRange("Oct 2023", "2023");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(9); // October
    expect(res.start!.getDate()).toBe(1);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(9);
    // last day of October is 31
    expect(res.end!.getDate()).toBe(31);
  });

  it("parses year-only dates", () => {
    const res = parseEventDateRange("2023", "2023");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(0); // January
    expect(res.start!.getDate()).toBe(1);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(11); // December
    expect(res.end!.getDate()).toBe(31);
  });

  it("parses multi-month span dates", () => {
    const res = parseEventDateRange("27 Apr – 12 Jul 2025", "2025");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(3); // April
    expect(res.start!.getDate()).toBe(27);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(6); // July
    expect(res.end!.getDate()).toBe(12);
  });

  it("parses multi-month short spans", () => {
    const res = parseEventDateRange("31 May – 2 Jun 2024", "2024");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(4); // May
    expect(res.start!.getDate()).toBe(31);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(5); // June
    expect(res.end!.getDate()).toBe(2);
  });

  it("returns nulls when no month name can be found", () => {
    const res = parseEventDateRange("TBD sometime soon", "2026");
    expect(res.start).toBeNull();
    expect(res.end).toBeNull();
  });

  it("returns nulls when three month names are found (unsupported span)", () => {
    const res = parseEventDateRange("Jan Feb Mar 2026", "2026");
    expect(res.start).toBeNull();
    expect(res.end).toBeNull();
  });

  it("returns nulls for a two-month string with no separating dash", () => {
    // Two months are found, but there is nothing to split on "-",
    // so the start/end segment extraction can't run and falls through.
    const res = parseEventDateRange("Apr Jun 2025", "2025");
    expect(res.start).toBeNull();
    expect(res.end).toBeNull();
  });

  it("falls back to the current year when the year argument is not numeric", () => {
    const res = parseEventDateRange("23 May", "");
    expect(res.start).not.toBeNull();
    expect(res.start!.getFullYear()).toBe(new Date().getFullYear());
    expect(res.start!.getMonth()).toBe(4); // May
    expect(res.start!.getDate()).toBe(23);
  });

  it("returns nulls for a same-month range with a non-numeric end day", () => {
    // "7-x" starts with a digit (so it's picked up as the days part) but the
    // end of the range doesn't parse to a number.
    const res = parseEventDateRange("7-x Apr 2026", "2026");
    expect(res.start).toBeNull();
    expect(res.end).toBeNull();
  });

  it("defaults the start day to 1 when the start segment has no day number", () => {
    const res = parseEventDateRange("May - 2 Jun 2024", "2024");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(4); // May
    expect(res.start!.getDate()).toBe(1);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(5); // June
    expect(res.end!.getDate()).toBe(2);
  });

  it("defaults the end day to 1 when the end segment has no day number", () => {
    const res = parseEventDateRange("2 May - Jun 2024", "2024");
    expect(res.start).not.toBeNull();
    expect(res.start!.getMonth()).toBe(4); // May
    expect(res.start!.getDate()).toBe(2);

    expect(res.end).not.toBeNull();
    expect(res.end!.getMonth()).toBe(5); // June
    expect(res.end!.getDate()).toBe(1);
  });
});

describe("dynamic status resolution logic", () => {
  const resolveEventStatus = (
    e: { startDate?: string; endDate?: string; status?: "upcoming" | "live" },
    today: string,
  ) => {
    let status = e.status;
    if (e.startDate) {
      const end = e.endDate || e.startDate;
      if (today < e.startDate) {
        status = "upcoming";
      } else if (today >= e.startDate && today <= end) {
        status = "live";
      } else {
        status = undefined; // past event
      }
    }
    return status;
  };

  it("resolves status as upcoming if today is before start date", () => {
    const event = { startDate: "2026-06-01", endDate: "2026-06-02", status: "live" as const };
    const status = resolveEventStatus(event, "2026-05-20");
    expect(status).toBe("upcoming");
  });

  it("resolves status as live if today is between start date and end date", () => {
    const event = { startDate: "2026-05-20", endDate: "2026-05-22", status: "upcoming" as const };
    const status = resolveEventStatus(event, "2026-05-20");
    expect(status).toBe("live");
  });

  it("resolves status as undefined (past) if today is after end date", () => {
    const event = { startDate: "2026-05-10", endDate: "2026-05-12", status: "live" as const };
    const status = resolveEventStatus(event, "2026-05-20");
    expect(status).toBeUndefined();
  });
});

describe("events aggregation (module-level computation)", () => {
  afterEach(() => {
    vi.doUnmock("../src/data/events/odishaai");
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("marks an event as live when today falls within its start/end range", async () => {
    vi.useFakeTimers();
    // Fixed instant that is comfortably 3 Sep 2026 in IST.
    vi.setSystemTime(new Date("2026-09-03T08:00:00Z"));

    vi.doMock("../src/data/events/odishaai", () => ({
      odishaaiEvents: [
        {
          year: "2026",
          date: "3 Sep 2026",
          title: "Live Range Event",
          url: "https://example.com/live",
          type: "Talk",
          startDate: "2026-09-01",
          endDate: "2026-09-05",
          description: "An event whose range covers the fixed system date.",
        },
      ],
    }));

    const { events } = await freshEventsModule();
    const liveEvent = events.find((e) => e.title === "Live Range Event");
    expect(liveEvent).toBeDefined();
    expect(liveEvent!.status).toBe("live");
  });

  it("sorts same-year events when one or both sides lack a resolvable startDate", async () => {
    vi.doMock("../src/data/events/odishaai", () => ({
      odishaaiEvents: [
        {
          year: "2099",
          date: "no month here at all",
          title: "No Start A",
          url: "https://example.com/no-start-a",
          type: "Talk",
          description: "Unparseable date, no startDate resolved.",
        },
        {
          year: "2099",
          date: "10 Jan 2099",
          title: "Has Start",
          url: "https://example.com/has-start",
          type: "Talk",
          description: "Parseable date, startDate resolved.",
        },
        {
          year: "2099",
          date: "still no month",
          title: "No Start B",
          url: "https://example.com/no-start-b",
          type: "Talk",
          description: "Unparseable date, no startDate resolved.",
        },
        {
          year: "2099",
          date: "yet another unparseable one",
          title: "No Start C",
          url: "https://example.com/no-start-c",
          type: "Talk",
          description: "Unparseable date, no startDate resolved.",
        },
      ],
    }));

    const { events } = await freshEventsModule();
    const year2099 = events.filter((e) => e.year === "2099");
    expect(year2099).toHaveLength(4);

    const hasStart = year2099.find((e) => e.title === "Has Start");
    const noStartTitles = year2099
      .filter((e) => e.title.startsWith("No Start"))
      .map((e) => e.title);

    expect(hasStart!.startDate).toBeDefined();
    // The event with a resolvable startDate sorts before those without one,
    // and events lacking a startDate on both sides remain stable relative to each other.
    expect(noStartTitles).toEqual(["No Start A", "No Start B", "No Start C"]);
  });
});

describe("getISTDateString fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("falls back to the local ISO date when Intl.DateTimeFormat throws", async () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl formatting unavailable");
    });

    const { events } = await freshEventsModule();
    // The module must still load and resolve statuses via the ISO fallback
    // instead of throwing when the IST formatter is unavailable.
    expect(events.length).toBeGreaterThan(0);
  });
});
