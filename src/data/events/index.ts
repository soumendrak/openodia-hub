/**
 * Aggregates all community event sources into a single sorted array.
 *
 * ─── HOW TO ADD A NEW COMMUNITY ───────────────────────────────────────────
 * 1. Create `src/data/events/<community-slug>.ts` following any existing file
 *    as a template (copy the header comment, import Event, export an array).
 * 2. Import your array below and add it to the `sources` list.
 * That's it — the event will appear automatically on the Events page.
 *
 * ─── HOW TO ADD AN EVENT TO AN EXISTING COMMUNITY ─────────────────────────
 * Open the community's `.ts` file and append a new object to its array.
 * See types.ts for all available fields.
 */

import type { Event } from "./types";
export type { Event, EventType } from "./types";

import { odishaaiEvents } from "./odishaai";
import { odiagenaiEvents } from "./odiagenai";
import { tfugBbsrEvents } from "./tfug-bbsr";
import { gdgBhubaneswarEvents } from "./gdg-bhubaneswar";
import { gdgocNistBerhampurEvents } from "./gdgoc-nist-berhampur";
import { gdgocKiitEvents } from "./gdgoc-kiit";
import { gdgocCvrEvents } from "./gdgoc-cvr";
import { gdgocIiitBbsrEvents } from "./gdgoc-iiit-bbsr";
import { gdgocIterSoaEvents } from "./gdgoc-iter-soa";

type RawEvent = Omit<Event, "community">;

/** Each entry pairs a display name with its raw event array.
 *  The `community` field is injected automatically — data files never set it. */
const sources: { community: string; events: RawEvent[] }[] = [
  { community: "Odisha AI", events: odishaaiEvents },
  { community: "OdiaGenAI", events: odiagenaiEvents },
  { community: "TFUG Bhubaneswar", events: tfugBbsrEvents },
  { community: "GDG Bhubaneswar", events: gdgBhubaneswarEvents },
  { community: "GDGoC NIST Berhampur", events: gdgocNistBerhampurEvents },
  { community: "GDGoC KIIT", events: gdgocKiitEvents },
  { community: "GDGoC CVR University", events: gdgocCvrEvents },
  { community: "GDGoC IIIT Bhubaneswar", events: gdgocIiitBbsrEvents },
  { community: "GDGoC ITER SOA", events: gdgocIterSoaEvents },
];

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseEventDateRange(
  dateStr: string,
  year: string,
): { start: Date | null; end: Date | null } {
  const cleanStr = dateStr.replace(/[–—-]/g, "-").trim();

  // 1. Single Year check (e.g., "2023")
  if (/^\d{4}$/.test(cleanStr)) {
    const y = parseInt(cleanStr, 10);
    return {
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31),
    };
  }

  const parts = cleanStr.split(/\s+/);

  // Find month indices in the parts
  const monthInfo: { index: number; name: string; val: number }[] = [];
  parts.forEach((p, idx) => {
    const lower = p.toLowerCase().slice(0, 3);
    if (MONTH_MAP[lower] !== undefined) {
      monthInfo.push({ index: idx, name: p, val: MONTH_MAP[lower] });
    }
  });

  const parsedYear = parseInt(year, 10) || new Date().getFullYear();

  // If no month found, return null
  if (monthInfo.length === 0) {
    return { start: null, end: null };
  }

  // Handle case: one month found (e.g., "23 May 2026", "7-8 Apr 2026", "Oct 2023")
  if (monthInfo.length === 1) {
    const month = monthInfo[0];
    const daysPart = parts.find((p) => {
      if (!/^\d+/.test(p)) return false;
      const v = parseInt(p, 10);
      return v < 1000; // exclude years
    });

    if (!daysPart) {
      // Month-only (e.g., "Oct 2023")
      return {
        start: new Date(parsedYear, month.val, 1),
        end: new Date(parsedYear, month.val + 1, 0),
      };
    }

    if (daysPart.includes("-")) {
      // Range within same month (e.g., "7-8 Apr 2026")
      const [sDay, eDay] = daysPart.split("-").map((d) => parseInt(d, 10));
      if (!isNaN(sDay) && !isNaN(eDay)) {
        return {
          start: new Date(parsedYear, month.val, sDay),
          end: new Date(parsedYear, month.val, eDay),
        };
      }
    } else {
      // Single day (e.g., "23 May 2026")
      const day = parseInt(daysPart, 10);
      if (!isNaN(day)) {
        return {
          start: new Date(parsedYear, month.val, day),
          end: new Date(parsedYear, month.val, day),
        };
      }
    }
  }

  // Handle case: multi-month span (e.g., "31 May - 2 Jun 2024", "27 Apr - 12 Jul 2025")
  if (monthInfo.length === 2) {
    const [startSegment, endSegment] = cleanStr.split("-").map((s) => s.trim());
    if (startSegment && endSegment) {
      const sParts = startSegment.split(/\s+/);
      const eParts = endSegment.split(/\s+/);

      // Extract start day & month
      const sMonth = monthInfo[0];
      const sDayPart = sParts.find((p) => /^\d+/.test(p) && parseInt(p, 10) < 1000);
      const sDay = sDayPart ? parseInt(sDayPart, 10) : 1;

      // Extract end day & month
      const eMonth = monthInfo[1];
      const eDayPart = eParts.find((p) => /^\d+/.test(p) && parseInt(p, 10) < 1000);
      const eDay = eDayPart ? parseInt(eDayPart, 10) : 1;

      return {
        start: new Date(parsedYear, sMonth.val, sDay),
        end: new Date(parsedYear, eMonth.val, eDay),
      };
    }
  }

  return { start: null, end: null };
}

function getISTDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/** All events merged, community-tagged, and dynamically evaluated for status & sorted newest-year-first. */
export const events: Event[] = sources
  .flatMap(({ community, events }) => events.map((e) => ({ ...e, community })))
  .map((event) => {
    // 1. Resolve explicit startDate/endDate if present, else parse the date string
    let startStr = event.startDate;
    let endStr = event.endDate;

    if (!startStr) {
      const parsed = parseEventDateRange(event.date, event.year);
      if (parsed.start) {
        // Format to YYYY-MM-DD
        const offset = parsed.start.getTimezoneOffset();
        const local = new Date(parsed.start.getTime() - offset * 60 * 1000);
        startStr = local.toISOString().split("T")[0];

        if (parsed.end) {
          const endLocal = new Date(parsed.end.getTime() - offset * 60 * 1000);
          endStr = endLocal.toISOString().split("T")[0];
        }
      }
    }

    // 2. Fall back to event's original status if parsing is impossible
    let status = event.status;

    if (startStr) {
      const today = getISTDateString();
      const end = endStr || startStr;

      if (today < startStr) {
        status = "upcoming";
      } else if (today >= startStr && today <= end) {
        status = "live";
      } else {
        status = undefined; // past event
      }
    }

    return {
      ...event,
      status,
      startDate: startStr,
      endDate: endStr,
    };
  })
  .sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year);
    if (yearDiff !== 0) return yearDiff;
    if (a.startDate && b.startDate) {
      return b.startDate.localeCompare(a.startDate);
    }
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return 0;
  });

/** Unique years present in the dataset, descending. */
export const YEARS = [...new Set(events.map((e) => e.year))].sort((a, b) => Number(b) - Number(a));

/** Unique community names, sorted alphabetically. */
export const COMMUNITIES = [...new Set(sources.map((s) => s.community))].sort();
