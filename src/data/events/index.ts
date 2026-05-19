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
  { community: "Odisha AI",             events: odishaaiEvents },
  { community: "OdiaGenAI",             events: odiagenaiEvents },
  { community: "TFUG Bhubaneswar",      events: tfugBbsrEvents },
  { community: "GDG Bhubaneswar",       events: gdgBhubaneswarEvents },
  { community: "GDGoC NIST Berhampur",  events: gdgocNistBerhampurEvents },
  { community: "GDGoC KIIT",            events: gdgocKiitEvents },
  { community: "GDGoC CVR University",  events: gdgocCvrEvents },
  { community: "GDGoC IIIT Bhubaneswar", events: gdgocIiitBbsrEvents },
  { community: "GDGoC ITER SOA",        events: gdgocIterSoaEvents },
];

/** All events merged, community-tagged, and sorted newest-year-first. */
export const events: Event[] = sources
  .flatMap(({ community, events }) => events.map((e) => ({ ...e, community })))
  .sort((a, b) => Number(b.year) - Number(a.year));

/** Unique years present in the dataset, descending. */
export const YEARS = [...new Set(events.map((e) => e.year))].sort(
  (a, b) => Number(b) - Number(a),
);

/** Unique community names, sorted alphabetically. */
export const COMMUNITIES = [...new Set(sources.map((s) => s.community))].sort();
