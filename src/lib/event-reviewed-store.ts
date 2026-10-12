import type { Event } from "../data/events/types";
import type { D1Like } from "./events-store";
import { eventUrlKey } from "./event-url";
import {
  mergeReviewedEvents,
  normalizeEventDates,
  REVIEW_FIELDS,
  validEventPatch,
  validateOverrides,
  type EventOverride,
  type EventPatch,
} from "./event-lifecycle";

/** Sidecar table avoids rewriting the existing events schema or fabricating review facts. */
export async function persistReviewedEvent(db: D1Like, event: Event): Promise<void> {
  if (!event.reviewedAt) return;
  const incoming: EventPatch = {};
  for (const key of event.reviewedFields ?? REVIEW_FIELDS)
    if (event[key] !== undefined) Object.assign(incoming, { [key]: event[key] });
  if (
    validateOverrides([
      { url: event.url, evidenceUrl: event.url, reviewedAt: event.reviewedAt, patch: incoming },
    ]).length
  )
    throw new Error("Invalid reviewed event metadata");
  const restored = (await restoreReviewedEvents(db, [event]))[0];
  const patch: EventPatch = {};
  for (const key of restored.reviewedFields ?? REVIEW_FIELDS)
    if (restored[key] !== undefined) Object.assign(patch, { [key]: restored[key] });
  if (
    (incoming.endDate !== undefined &&
      restored.startDate !== undefined &&
      incoming.endDate < restored.startDate) ||
    validateOverrides([
      { url: event.url, evidenceUrl: event.url, reviewedAt: restored.reviewedAt!, patch },
    ]).length
  )
    throw new Error("Invalid reviewed event metadata");
  const reviewedAt = new Date(restored.reviewedAt!).toISOString();
  await db
    .prepare(
      `INSERT INTO event_reviewed_metadata (event_id, payload_json, reviewed_at)
    VALUES (?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET payload_json = excluded.payload_json,
    reviewed_at = excluded.reviewed_at WHERE excluded.reviewed_at > event_reviewed_metadata.reviewed_at`,
    )
    .bind(
      eventUrlKey(event.url),
      JSON.stringify({ patch, reviewedFields: restored.reviewedFields }),
      reviewedAt,
    )
    .run();
}

export async function restoreReviewedEvents(db: D1Like, events: Event[]): Promise<Event[]> {
  const result = await db
    .prepare("SELECT event_id, payload_json, reviewed_at FROM event_reviewed_metadata")
    .all<{ event_id: string; payload_json: string; reviewed_at: string }>();
  const byUrl = new Map(events.map((event) => [eventUrlKey(event.url), event]));
  for (const row of result.results) {
    const event = byUrl.get(row.event_id);
    if (!event) continue;
    try {
      const payload = JSON.parse(row.payload_json);
      if (
        !payload ||
        !payload.patch ||
        typeof payload.patch !== "object" ||
        !validEventPatch(payload.patch)
      )
        throw new Error("Invalid reviewed payload");
      const testOverride: EventOverride = {
        url: event.url,
        evidenceUrl: event.url,
        reviewedAt: row.reviewed_at,
        patch: payload.patch,
      };
      if (validateOverrides([testOverride]).length) throw new Error("Invalid review timestamp");
      // Re-derive fields from the admitted patch, never trust unknown persisted field names.
      byUrl.set(
        row.event_id,
        normalizeEventDates(
          mergeReviewedEvents(event, {
            ...event,
            ...payload.patch,
            reviewedAt: row.reviewed_at,
            reviewedFields: Object.keys(payload.patch) as (typeof REVIEW_FIELDS)[number][],
          }),
        ),
      );
    } catch {
      console.warn("Invalid reviewed event metadata ignored");
    }
  }
  return [...byUrl.values()];
}
