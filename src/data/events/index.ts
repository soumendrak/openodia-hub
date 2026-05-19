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

const sources = [
  odishaaiEvents,
  odiagenaiEvents,
  tfugBbsrEvents,
  gdgBhubaneswarEvents,
  gdgocNistBerhampurEvents,
  gdgocKiitEvents,
  gdgocCvrEvents,
  gdgocIiitBbsrEvents,
  gdgocIterSoaEvents,
];

/** All events merged and sorted newest-year-first. */
export const events = sources
  .flat()
  .sort((a, b) => Number(b.year) - Number(a.year));

/** Unique years present in the dataset, descending. */
export const YEARS = [...new Set(events.map((e) => e.year))].sort(
  (a, b) => Number(b) - Number(a),
);
