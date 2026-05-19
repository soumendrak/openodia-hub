import { describe, it, expect } from "vitest";
import { parseEventDateRange } from "../src/data/events/index";

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
