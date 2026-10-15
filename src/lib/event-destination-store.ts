import type { Event } from "../data/events/types";
import type { D1Like } from "./events-store";
import { eventUrlKey, isGdgEventUrl, resolveEventDestinationUrl } from "./event-url";
import { mapWithConcurrency } from "./fetch-utils";

const MAX_REDIRECT_REQUESTS = 30;
const MAX_URLS_PER_SYNC = 30;
export type AliasRow = { alias_url: string; destination_url: string | null; checked_at: string };
export const SELECT_ALIASES =
  "SELECT alias_url, destination_url, checked_at FROM event_destination_aliases";

function admittedAliases(rows: readonly AliasRow[]): Map<string, string> {
  return new Map(
    rows
      .filter(
        (row) =>
          typeof row.alias_url === "string" &&
          typeof row.destination_url === "string" &&
          isGdgEventUrl(row.alias_url) &&
          isGdgEventUrl(row.destination_url),
      )
      .map((row) => [eventUrlKey(row.alias_url), row.destination_url!]),
  );
}

/** A persisted HTTP observation is an alias, never a human-reviewed lifecycle fact. */
export async function readEventDestinationAliases(db: D1Like): Promise<Map<string, string>> {
  return admittedAliases((await db.prepare(SELECT_ALIASES).all<AliasRow>()).results);
}

/** Follow recorded aliases across date changes without issuing a request. */
export function storedEventDestination(url: string, aliases: ReadonlyMap<string, string>): string {
  const visited = new Set<string>();
  let destination = url;
  while (aliases.has(eventUrlKey(destination))) {
    const key = eventUrlKey(destination);
    if (visited.has(key)) return url;
    visited.add(key);
    const next = aliases.get(key)!;
    if (eventUrlKey(next) === key) return next;
    destination = next;
  }
  return destination;
}

/**
 * Cron checks oldest/unseen URLs with at most three connections. Each
 * redirect hop spends the same 30-request budget (including failed requests).
 * Together with five single-request chapter reads this stays below Free's 50.
 */
export async function refreshEventDestinationAliases(
  db: D1Like,
  events: readonly Pick<Event, "url">[],
  fetcher: typeof fetch = fetch,
  /** URLs that exist nowhere else (standalone overrides) are checked first. */
  priority: readonly string[] = [],
  /**
   * `rows` is a snapshot the caller already read; with `deferWrite` the
   * observation upsert is returned as `write` for the caller's batch instead.
   */
  options: { rows?: readonly AliasRow[]; deferWrite?: boolean } = {},
): Promise<{
  aliases: Map<string, string>;
  requests: number;
  checked: number;
  write?: ReturnType<D1Like["prepare"]>;
}> {
  const first = new Set(priority.map(eventUrlKey));
  const rows = options.rows ?? (await db.prepare(SELECT_ALIASES).all<AliasRow>()).results;
  const aliases = admittedAliases(rows);
  const attempts = new Map(rows.map((row) => [row.alias_url, Date.parse(row.checked_at) || 0]));
  const urls = new Map(
    events
      .filter((event) => isGdgEventUrl(event.url))
      .map((event) => [eventUrlKey(event.url), event.url]),
  );
  const selected = [...urls]
    .sort(
      ([a], [b]) =>
        (attempts.has(a) ? 1 : 0) - (attempts.has(b) ? 1 : 0) ||
        (first.has(a) ? 0 : 1) - (first.has(b) ? 0 : 1) ||
        (attempts.get(a) ?? 0) - (attempts.get(b) ?? 0) ||
        a.localeCompare(b),
    )
    .slice(0, MAX_URLS_PER_SYNC);
  let requests = 0;
  let checked = 0;
  const observations: AliasRow[] = [];
  await mapWithConcurrency(selected, 3, async ([key, url]) => {
    let confirmed = false;
    let attempted = false;
    const destination = await resolveEventDestinationUrl(url, async (input, init) => {
      if (requests >= MAX_REDIRECT_REQUESTS)
        throw new Error("Event redirect request budget exhausted");
      attempted = true;
      requests++;
      const response = await fetcher(input, init);
      confirmed = response.ok;
      return response;
    });
    // Leave unattempted URLs unseen so the next invocation prioritizes them.
    if (!attempted) return;
    checked++;
    observations.push({
      alias_url: key,
      destination_url: confirmed ? destination : null,
      checked_at: new Date().toISOString(),
    });
    if (confirmed) aliases.set(key, destination);
  });
  const write = observations.length
    ? db
        .prepare(
          `INSERT INTO event_destination_aliases(alias_url, destination_url, checked_at)
    SELECT json_extract(value, '$.alias_url'), json_extract(value, '$.destination_url'), json_extract(value, '$.checked_at')
    FROM json_each(?) WHERE true ON CONFLICT(alias_url) DO UPDATE SET
    destination_url = COALESCE(excluded.destination_url, event_destination_aliases.destination_url),
    checked_at = excluded.checked_at WHERE excluded.checked_at >= event_destination_aliases.checked_at`,
        )
        .bind(JSON.stringify(observations))
    : undefined;
  if (write && !options.deferWrite) await write.run();
  return { aliases, requests, checked, ...(options.deferWrite ? { write } : {}) };
}
