import { applyEventOverrides, mergeReviewedEvents } from "./event-lifecycle";
import { events as curated } from "../data/events";
import { refreshEventDestinationAliases, storedEventDestination } from "./event-destination-store";
import { EVENT_OVERRIDES } from "../data/event-overrides";
import { persistReviewedEvents, restoreReviewedEvents } from "./event-reviewed-store";
/**
 * D1-backed persistence for Bevy-scraped community events.
 *
 * Sync runs on a Cloudflare cron trigger (see wrangler.jsonc `triggers.crons`)
 * and writes into the EVENTS_DB binding. Reads from `/api/events` consult the
 * same table; if the DB is unavailable or empty, the request handler falls
 * back to a live Bevy scrape so the page never goes blank.
 */

import { CHAPTERS, fetchChapterOutcome } from "../routes/api/events";
import { settledValues } from "./fetch-utils";
import { dedupeEventsByResolvedUrl, dedupeEventsByUrl, eventUrlKey } from "./event-url";
import type { Event } from "../data/events/types";
import { resolveOrganizerId } from "../data/organizers";

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  run: () => Promise<unknown>;
  all: <T = unknown>() => Promise<{ results: T[] }>;
};
export type D1Like = {
  prepare: (query: string) => D1PreparedStatement;
};

type Row = {
  url: string;
  title: string;
  community: string;
  type: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  location: string | null;
};

const UPSERT_SQL = `
INSERT INTO events (id, url, title, community, type, start_date, end_date, description, location, source)
SELECT json_extract(value, '$.id'), json_extract(value, '$.url'), json_extract(value, '$.title'),
  json_extract(value, '$.community'), json_extract(value, '$.type'), json_extract(value, '$.startDate'),
  json_extract(value, '$.endDate'), json_extract(value, '$.description'), json_extract(value, '$.location'), 'bevy'
FROM json_each(?) WHERE true
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  community = excluded.community,
  type = excluded.type,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  description = excluded.description,
  location = excluded.location,
  last_seen = datetime('now'),
  is_active = 1
`;

// Active events + recently-deactivated ones (30-day grace period) so events
// briefly missing from a single Bevy fetch don't disappear from the site.
const SELECT_ACTIVE_SQL = `
SELECT url, title, community, type, start_date, end_date, description, location
FROM events
WHERE source = 'bevy'
  AND (is_active = 1 OR last_seen > datetime('now', '-30 days'))
ORDER BY start_date DESC
`;

export async function syncEventsToD1(db: D1Like): Promise<{ upserted: number }> {
  const settled = await Promise.allSettled(
    CHAPTERS.map((c) => fetchChapterOutcome(c.organizerId ?? c.community, c.slug)),
  );
  let events = dedupeEventsByUrl(settledValues(settled).flatMap((outcome) => outcome.events)).map(
    (event) => applyEventOverrides(event, EVENT_OVERRIDES),
  );
  const previous = await readEventRecords(db);
  const reviewedHistory = await restoreReviewedEvents(db, [...curated, ...previous]);
  const { aliases } = await refreshEventDestinationAliases(db, [
    ...curated,
    ...previous,
    ...events,
  ]);
  events = await dedupeEventsByResolvedUrl(
    events,
    async (url) => storedEventDestination(url, aliases),
    mergeReviewedEvents,
    true,
  );

  // Preserve reviewed alias facts at the canonical identity before the old
  // base row retires. Only current live rows count as seen upstream.
  const previousCanonical = await dedupeEventsByResolvedUrl(
    [
      ...curated.map((event) => applyEventOverrides(event, EVENT_OVERRIDES)),
      ...reviewedHistory.map((event) => applyEventOverrides(event, EVENT_OVERRIDES)),
    ],
    async (url) => storedEventDestination(url, aliases),
    mergeReviewedEvents,
    true,
  );
  const byUrl = new Map(previousCanonical.map((event) => [eventUrlKey(event.url), event]));
  events = events.map((event) => {
    const old = byUrl.get(eventUrlKey(event.url));
    return applyEventOverrides(old ? mergeReviewedEvents(old, event) : event, EVENT_OVERRIDES);
  });
  // Every checked-in correction is cached, including archive-only/removed URLs.
  await persistReviewedEvents(db, [
    ...previousCanonical,
    ...events,
    ...EVENT_OVERRIDES.map((override) => ({
      url: override.url,
      ...override.patch,
      reviewedAt: override.reviewedAt,
      reviewedFields: Object.keys(override.patch) as NonNullable<Event["reviewedFields"]>,
    })),
  ]);
  const rows = events
    .filter((event) => event.url && event.startDate)
    .map((event) => ({
      ...event,
      id: eventUrlKey(event.url),
      endDate: event.endDate ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
    }));
  const seenIds = rows.map((event) => event.id);
  const complete = settled.every(
    (outcome) => outcome.status === "fulfilled" && outcome.value.status.outcome !== "failed",
  );
  // Readers treat any non-empty D1 as the authoritative snapshot, so a partial
  // run must not seed an empty database; the live fallback stays in charge.
  if (!complete && previous.length === 0) return { upserted: 0 };
  // One bound JSON value avoids D1's 100-parameter and 50-query limits.
  if (rows.length) await db.prepare(UPSERT_SQL).bind(JSON.stringify(rows)).run();

  // Deactivate Bevy events no longer present upstream. Static events are not
  // tracked here, so the WHERE clause scopes to source='bevy'.
  if (seenIds.length > 0 && complete) {
    await db
      .prepare(
        `UPDATE events SET is_active = 0 WHERE source = 'bevy' AND id NOT IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify(seenIds))
      .run();
  }

  return { upserted: seenIds.length };
}

async function readEventRecords(db: D1Like): Promise<Event[]> {
  const result = await db.prepare(SELECT_ACTIVE_SQL).all<Row>();
  return dedupeEventsByUrl(
    result.results.map((r) => {
      const organizerId = resolveOrganizerId(r.community);
      return {
        url: r.url,
        title: r.title,
        community: r.community,
        ...(organizerId ? { organizerId } : {}),
        type: r.type as Event["type"],
        year: r.start_date.split("-")[0],
        date: r.start_date,
        startDate: r.start_date,
        endDate: r.end_date ?? undefined,
        description: r.description ?? "",
        location: r.location ?? undefined,
      };
    }),
  );
}

export async function readEventsFromD1(db: D1Like): Promise<Event[]> {
  const events = await readEventRecords(db);
  try {
    return (await restoreReviewedEvents(db, events)).map((event) =>
      applyEventOverrides(event, EVENT_OVERRIDES),
    );
  } catch (error) {
    if (!(error instanceof Error) || !/no such table.*event_reviewed_metadata/i.test(error.message))
      throw error;
    console.warn(
      "Reviewed event metadata unavailable; serving legacy records with checked-in corrections",
    );
    return events.map((event) => applyEventOverrides(event, EVENT_OVERRIDES));
  }
}
