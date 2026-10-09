/**
 * D1-backed persistence for Bevy-scraped community events.
 *
 * Sync runs on a Cloudflare cron trigger (see wrangler.jsonc `triggers.crons`)
 * and writes into the EVENTS_DB binding. Reads from `/api/events` consult the
 * same table; if the DB is unavailable or empty, the request handler falls
 * back to a live Bevy scrape so the page never goes blank.
 */

import { CHAPTERS, fetchChapterEventsOrThrow } from "../routes/api/events";
import { settledValues } from "./fetch-utils";
import { dedupeEventsByUrl, eventUrlKey } from "./event-url";
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

const RETIRE_SQL = `
UPDATE events SET is_active = 0
WHERE source = 'bevy'
  AND community IN (SELECT value FROM json_each(?))
  AND id NOT IN (SELECT value FROM json_each(?))
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
    CHAPTERS.map((c) => fetchChapterEventsOrThrow(c.organizerId ?? c.community, c.slug)),
  );
  const succeededCommunities = CHAPTERS.filter((_, i) => settled[i].status === "fulfilled").map(
    (c) => c.community,
  );
  const events = dedupeEventsByUrl(settledValues(settled).flat());

  const seenIds: string[] = [];
  for (const e of events) {
    if (!e.url || !e.startDate) continue;
    const id = eventUrlKey(e.url);
    seenIds.push(id);
    await db
      .prepare(UPSERT_SQL)
      .bind(
        id,
        e.url,
        e.title,
        e.community,
        e.type,
        e.startDate,
        e.endDate ?? null,
        e.description ?? null,
        e.location ?? null,
      )
      .run();
  }

  // Deactivate Bevy events no longer present upstream. Static events are not
  // tracked here, so the WHERE clause scopes to source='bevy'. Only chapters
  // that fetched successfully may retire their rows: a failed fetch is not
  // evidence that its events are gone. Both lists are bound as JSON arrays so
  // the query stays within D1's 100-bound-parameter limit however many events
  // were seen.
  if (seenIds.length > 0) {
    await db
      .prepare(RETIRE_SQL)
      .bind(JSON.stringify(succeededCommunities), JSON.stringify(seenIds))
      .run();
  }

  return { upserted: seenIds.length };
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
