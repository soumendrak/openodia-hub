/**
 * D1-backed persistence for Bevy-scraped community events.
 *
 * Sync runs on a Cloudflare cron trigger (see wrangler.jsonc `triggers.crons`)
 * and writes into the EVENTS_DB binding. Reads from `/api/events` consult the
 * same table; if the DB is unavailable or empty, the request handler falls
 * back to a live Bevy scrape so the page never goes blank.
 */

import { CHAPTERS, fetchChapterOutcome, type EventSourceStatus } from "../routes/api/events";
import { dedupeEventsByUrl, eventUrlKey } from "./event-url";
import type { Event } from "../data/events/types";
import { events as curatedEvents } from "../data/events";
import { getOrganizerById, resolveOrganizerId } from "../data/organizers";

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

export const UPSERT_SQL = `
INSERT INTO events (id, url, title, community, type, start_date, end_date, description, location, source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bevy')
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

// A row can belong to several chapter feeds. Retirement needs every known
// owner to have authoritatively removed it; an unavailable cohost protects it.
export const RETIRE_SQL = `
UPDATE events SET is_active = 0
WHERE source = 'bevy'
 AND EXISTS (SELECT 1 FROM event_source_memberships m WHERE m.event_id = events.id)
 AND NOT EXISTS (SELECT 1 FROM event_source_memberships m WHERE m.event_id = events.id AND m.is_active = 1)
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
  const outcomes = await Promise.all(
    CHAPTERS.map((chapter) =>
      fetchChapterOutcome(chapter.organizerId ?? chapter.community, chapter.slug),
    ),
  );
  const seenIds = new Set<string>();
  for (const [index, chapter] of CHAPTERS.entries()) {
    const { events, status, upcomingComplete, pastComplete } = outcomes[index];
    const names = [
      chapter.community,
      ...(chapter.organizerId ? getOrganizerById(chapter.organizerId).aliases : []),
    ];
    // Safe legacy migration: exact registry aliases only. Unknown ownership is
    // retained, and newly observed cohosts add ownership rather than overwrite it.
    await db
      .prepare(
        `INSERT OR IGNORE INTO event_source_memberships (event_id, source_id, is_active)
      SELECT id, ?, is_active FROM events WHERE source = 'bevy'
      AND community IN (SELECT value FROM json_each(?))`,
      )
      .bind(chapter.slug, JSON.stringify(names))
      .run();
    const chapterIds: string[] = [];
    for (const event of events) {
      if (!event.url || !event.startDate) continue;
      const id = eventUrlKey(event.url);
      chapterIds.push(id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const primary = curatedEvents.find((curated) => eventUrlKey(curated.url) === id);
        await db
          .prepare(UPSERT_SQL)
          .bind(
            id,
            event.url,
            event.title,
            primary?.community ?? event.community,
            event.type,
            event.startDate,
            event.endDate ?? null,
            event.description ?? null,
            event.location ?? null,
          )
          .run();
      }
      await db
        .prepare(
          `INSERT INTO event_source_memberships (event_id, source_id, is_active)
        VALUES (?, ?, 1) ON CONFLICT(event_id, source_id) DO UPDATE SET is_active=1`,
        )
        .bind(id, chapter.slug)
        .run();
    }
    if (
      status.outcome !== "failed" &&
      upcomingComplete &&
      events.every((event) => event.url && event.startDate)
    ) {
      await db
        .prepare(
          `UPDATE event_source_memberships SET is_active=0 WHERE source_id=?
        AND event_id NOT IN (SELECT value FROM json_each(?))
        AND (?=1 OR event_id IN (SELECT id FROM events WHERE start_date >= date('now', '+5 hours', '+30 minutes')))`,
        )
        .bind(chapter.slug, JSON.stringify(chapterIds), Number(pastComplete))
        .run();
    }
    await db
      .prepare(
        `INSERT INTO event_source_status
      (source_id, outcome, event_count, last_attempt_at, last_success_at, error_category, upcoming_complete, past_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET outcome=excluded.outcome, event_count=excluded.event_count,
      last_attempt_at=excluded.last_attempt_at,
      last_success_at=COALESCE(excluded.last_success_at, event_source_status.last_success_at),
      error_category=excluded.error_category, upcoming_complete=excluded.upcoming_complete, past_complete=excluded.past_complete`,
      )
      .bind(
        chapter.slug,
        status.outcome,
        status.eventCount,
        status.lastAttemptAt,
        status.lastSuccessAt ?? null,
        status.errorCategory ?? null,
        Number(upcomingComplete),
        Number(pastComplete),
      )
      .run();
  }
  // A removed or renamed chapter is never visited again, so its memberships
  // would protect rows forever. Renamed chapters re-adopt rows via the alias
  // migration above before this runs; unowned legacy rows have no membership.
  await db
    .prepare(
      `UPDATE event_source_memberships SET is_active = 0
    WHERE source_id NOT IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(CHAPTERS.map((chapter) => chapter.slug)))
    .run();
  await db.prepare(RETIRE_SQL).run();
  return { upserted: seenIds.size };
}

export async function readEventSourceStatuses(db: D1Like): Promise<EventSourceStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT source_id, outcome, event_count, last_attempt_at,
    last_success_at, error_category, upcoming_complete, past_complete FROM event_source_status`,
    )
    .all<{
      source_id: string;
      outcome: EventSourceStatus["outcome"];
      event_count: number;
      last_attempt_at: string;
      last_success_at: string | null;
      error_category: EventSourceStatus["errorCategory"] | null;
      upcoming_complete: number;
      past_complete: number;
    }>();
  return CHAPTERS.flatMap((chapter) =>
    results
      .filter((row) => row.source_id === chapter.slug)
      .map((row) => ({
        sourceId: row.source_id,
        outcome: row.outcome,
        eventCount: row.event_count,
        lastAttemptAt: row.last_attempt_at,
        lastSuccessAt: row.last_success_at ?? undefined,
        errorCategory: row.error_category ?? undefined,
        upcomingComplete: Boolean(row.upcoming_complete),
        pastComplete: Boolean(row.past_complete),
      })),
  );
}

export async function readEventsFromD1(db: D1Like): Promise<Event[]> {
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
