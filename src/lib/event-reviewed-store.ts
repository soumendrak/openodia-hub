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

/** An override persists only admitted fields; no base event record is fabricated. */
export async function persistReviewedOverride(db: D1Like, override: EventOverride): Promise<void> {
  if (validateOverrides([override]).length) throw new Error("Invalid reviewed event metadata");
  await persistReviewedEvent(db, {
    url: override.url,
    ...override.patch,
    reviewedAt: override.reviewedAt,
    reviewedFields: Object.keys(override.patch) as (typeof REVIEW_FIELDS)[number][],
  });
}

/** Sidecar table avoids rewriting the existing events schema or fabricating review facts. */
export async function persistReviewedEvent(
  db: D1Like,
  event: Pick<Event, "url"> & Partial<Event>,
): Promise<void> {
  await persistReviewedEvents(db, [event]);
}

// The stored sidecar, or '{}' when it is malformed or structurally invalid, so a
// valid review repairs it instead of aborting the write. Nested CASE: json_type
// must never see invalid JSON.
const STORED = `(CASE WHEN json_valid(event_reviewed_metadata.payload_json) THEN CASE
  WHEN json_type(event_reviewed_metadata.payload_json, '$.patch') = 'object'
   AND COALESCE(json_type(event_reviewed_metadata.payload_json, '$.reviewedTimes'), 'object') = 'object'
  THEN event_reviewed_metadata.payload_json ELSE '{}' END ELSE '{}' END)`;

// Every conflict merges field by field on per-field review times (an untimed key
// takes its own row's reviewed_at; ties keep the stored value), so concurrent
// writers never replace each other's fields.
export const REVIEWED_UPSERT_SQL = `INSERT INTO event_reviewed_metadata (event_id, payload_json, reviewed_at)
    SELECT json_extract(value, '$.event_id'), json_extract(value, '$.payload_json'), json_extract(value, '$.reviewed_at')
    FROM json_each(?) WHERE true ON CONFLICT(event_id) DO UPDATE SET payload_json =
        json_object('patch', (
          SELECT json_group_object(key, CASE WHEN type IN ('object','array') THEN json(value) ELSE value END)
          FROM (
            SELECT existing.key, existing.value, existing.type FROM json_each(${STORED}, '$.patch') existing
            WHERE NOT EXISTS (SELECT 1 FROM json_each(excluded.payload_json, '$.patch') incoming WHERE incoming.key = existing.key
              AND COALESCE(json_extract(excluded.payload_json, '$.reviewedTimes.' || incoming.key), excluded.reviewed_at)
                > COALESCE(json_extract(${STORED}, '$.reviewedTimes.' || existing.key), event_reviewed_metadata.reviewed_at))
            UNION ALL
            SELECT incoming.key, incoming.value, incoming.type FROM json_each(excluded.payload_json, '$.patch') incoming
            WHERE NOT EXISTS (SELECT 1 FROM json_each(${STORED}, '$.patch') existing WHERE existing.key = incoming.key
              AND COALESCE(json_extract(excluded.payload_json, '$.reviewedTimes.' || incoming.key), excluded.reviewed_at)
                <= COALESCE(json_extract(${STORED}, '$.reviewedTimes.' || existing.key), event_reviewed_metadata.reviewed_at))
          )
        ), 'reviewedTimes', (
          SELECT json_group_object(key, at) FROM (
            SELECT key, max(at) AS at FROM (
              SELECT existing.key, COALESCE(json_extract(${STORED}, '$.reviewedTimes.' || existing.key), event_reviewed_metadata.reviewed_at) AS at
              FROM json_each(${STORED}, '$.patch') existing
              UNION ALL
              SELECT incoming.key, COALESCE(json_extract(excluded.payload_json, '$.reviewedTimes.' || incoming.key), excluded.reviewed_at) AS at
              FROM json_each(excluded.payload_json, '$.patch') incoming
            ) GROUP BY key
          )
        )),
    reviewed_at = max(excluded.reviewed_at, event_reviewed_metadata.reviewed_at)`;

/** A whole sync uses one read and one JSON-bound write regardless of review count. */
export async function persistReviewedEvents(
  db: D1Like,
  events: (Pick<Event, "url"> & Partial<Event>)[],
): Promise<void> {
  const reviewed = events.filter((event) => event.reviewedAt);
  if (!reviewed.length) return;
  const merged = new Map<string, Event>();
  for (const event of reviewed) {
    const incoming: EventPatch = {};
    for (const key of event.reviewedFields ?? REVIEW_FIELDS)
      if (event[key] !== undefined) Object.assign(incoming, { [key]: event[key] });
    if (
      validateOverrides([
        { url: event.url, evidenceUrl: event.url, reviewedAt: event.reviewedAt!, patch: incoming },
      ]).length
    )
      throw new Error("Invalid reviewed event metadata");
    const key = eventUrlKey(event.url);
    const previous = merged.get(key);
    merged.set(key, previous ? mergeReviewedEvents(previous, event as Event) : (event as Event));
  }
  const restored = await restoreReviewedEvents(db, [...merged.values()]);
  const records = restored.map((event) => {
    const patch: EventPatch = {};
    for (const key of event.reviewedFields ?? REVIEW_FIELDS)
      if (event[key] !== undefined) Object.assign(patch, { [key]: event[key] });
    const incoming = merged.get(eventUrlKey(event.url))!;
    if (
      ((incoming.reviewedFields ?? REVIEW_FIELDS).includes("endDate") &&
        incoming.endDate !== undefined &&
        event.startDate !== undefined &&
        incoming.endDate < event.startDate) ||
      validateOverrides([
        { url: event.url, evidenceUrl: event.url, reviewedAt: event.reviewedAt!, patch },
      ]).length
    )
      throw new Error("Invalid reviewed event metadata");
    return {
      event_id: eventUrlKey(event.url),
      payload_json: JSON.stringify({
        patch,
        reviewedFields: event.reviewedFields,
        reviewedTimes: event.reviewedTimes,
      }),
      reviewed_at: new Date(event.reviewedAt!).toISOString(),
    };
  });
  // A malformed stored payload is treated as empty so a valid review repairs it.
  // Every conflict merges field by field on per-field review times (ties keep
  // the stored value), so concurrent writers never replace each other's fields.
  await db.prepare(REVIEWED_UPSERT_SQL).bind(JSON.stringify(records)).run();
}

export async function restoreReviewedEvents(
  db: D1Like,
  events: Event[],
  /** Called for each matching row that is ignored as invalid; callers mark results partial. */
  onInvalid: () => void = () => {},
): Promise<Event[]> {
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
      // Same rule as applyEventOverrides: an unchanged day keeps the base duration.
      const changedDay =
        (payload.patch.lifecycle?.replacementDate !== undefined &&
          payload.patch.lifecycle.replacementDate !== event.lifecycle?.replacementDate) ||
        (payload.patch.startDate !== undefined && payload.patch.startDate !== event.startDate);
      // Re-derive fields from the admitted patch, never trust unknown persisted field names.
      const restored = normalizeEventDates(
        mergeReviewedEvents(event, {
          ...event,
          ...payload.patch,
          reviewedAt: row.reviewed_at,
          reviewedFields: Object.keys(payload.patch) as (typeof REVIEW_FIELDS)[number][],
          reviewedTimes:
            payload.reviewedTimes && typeof payload.reviewedTimes === "object"
              ? payload.reviewedTimes
              : undefined,
        }),
        !changedDay,
      );
      // A reviewed end the (possibly moved) base start has overtaken is not a
      // valid range; drop it rather than the row's other reviewed facts.
      if (restored.endDate && restored.startDate && restored.endDate < restored.startDate) {
        restored.endDate =
          event.endDate && event.endDate >= restored.startDate ? event.endDate : undefined;
        // The fallback is not a reviewed fact; never protect it as one.
        restored.reviewedFields = restored.reviewedFields?.filter((key) => key !== "endDate");
        if (restored.reviewedTimes) {
          const { endDate: _discarded, ...times } = restored.reviewedTimes;
          restored.reviewedTimes = times;
        }
      }
      byUrl.set(row.event_id, restored);
    } catch {
      onInvalid();
      console.warn("Invalid reviewed event metadata ignored");
    }
  }
  return [...byUrl.values()];
}
