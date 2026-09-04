import type { Event } from "../data/events/types";

const TRACKING_QUERY_PARAMS = new Set(["dclid", "fbclid", "gclid", "mc_cid", "mc_eid", "msclkid"]);
const DESTINATION_CACHE_TTL_MS = 60 * 60 * 1000;
const destinationCache = new Map<string, { destination: string; expiresAt: number }>();

function isGdgEventUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.hostname.toLowerCase() === "gdg.community.dev" &&
      url.pathname.startsWith("/events/details/")
    );
  } catch {
    return false;
  }
}

/**
 * Returns the destination-address key used everywhere events are deduplicated.
 *
 * GDG exposes the same Bevy event through chapter-specific `/cohost-*` URLs.
 * Fragments, tracking parameters, parameter order, and a trailing slash also do
 * not identify a different destination event.
 */
export function eventUrlKey(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  try {
    const url = new URL(trimmed);
    url.hash = "";

    if (url.hostname.toLowerCase() === "gdg.community.dev") {
      url.pathname = url.pathname.replace(/\/cohost-[^/]+\/?$/i, "");
    }

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();

    return url.toString();
  } catch {
    return trimmed.replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

/** Keeps the first occurrence of each destination event URL. */
export function dedupeEventsByUrl<T extends Pick<Event, "url">>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = eventUrlKey(item.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Follow a renamed GDG event slug to the destination address used for dedup. */
export async function resolveEventDestinationUrl(
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!isGdgEventUrl(rawUrl)) return rawUrl;

  try {
    const response = await fetcher(rawUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "OpenOdiaBot/1.0 (+https://openodia.org)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.url || !isGdgEventUrl(response.url)) return rawUrl;
    return response.url;
  } catch {
    return rawUrl;
  }
}

async function cachedDestinationUrl(rawUrl: string): Promise<string> {
  const now = Date.now();
  const cached = destinationCache.get(rawUrl);
  if (cached && cached.expiresAt > now) return cached.destination;

  const destination = await resolveEventDestinationUrl(rawUrl);
  destinationCache.set(rawUrl, { destination, expiresAt: now + DESTINATION_CACHE_TTL_MS });
  return destination;
}

type DatedEventUrl = Pick<Event, "url"> & Partial<Pick<Event, "startDate" | "date">>;

/**
 * Resolves redirects only when multiple records share a date, then keeps the
 * first record for each final destination. This cleans up stale D1 rows after
 * a GDG title/slug edit without putting a network request on every event.
 */
export async function dedupeEventsByResolvedUrl<T extends DatedEventUrl>(
  items: T[],
  resolveDestination: (url: string) => Promise<string> = cachedDestinationUrl,
): Promise<T[]> {
  const dateCounts = new Map<string, number>();
  for (const item of items) {
    const date = item.startDate || item.date || "";
    dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }

  const destinations = await Promise.all(
    items.map((item) => {
      const date = item.startDate || item.date || "";
      // Counted from this same `items` list above, so every date has an entry.
      return dateCounts.get(date)! > 1 ? resolveDestination(item.url) : Promise.resolve(item.url);
    }),
  );

  const winners = new Map<string, { item: T; isDirectDestination: boolean }>();
  items.forEach((item, index) => {
    const destination = destinations[index];
    const key = eventUrlKey(destination);
    const isDirectDestination = eventUrlKey(item.url) === key;
    const existing = winners.get(key);

    // Prefer the record already stored at the final URL. It carries the latest
    // title/metadata; a redirecting legacy row may still have an obsolete name.
    if (!existing || (isDirectDestination && !existing.isDirectDestination)) {
      winners.set(key, {
        item: { ...item, url: destination },
        isDirectDestination,
      });
    }
  });

  return [...winners.values()].map(({ item }) => item);
}

/**
 * Merges a live event collection into an archived collection by destination.
 * Archived duplicates retain the existing last-entry behavior; a matching live
 * event is combined with the archive through the caller's metadata policy.
 */
export function mergeEventCollectionsByUrl<T extends Pick<Event, "url">>(
  archived: T[],
  live: T[],
  merge: (archivedEvent: T, liveEvent: T) => T,
): T[] {
  const byDestination = new Map<string, T>();
  for (const event of archived) byDestination.set(eventUrlKey(event.url), event);
  for (const event of live) {
    const key = eventUrlKey(event.url);
    const existing = byDestination.get(key);
    byDestination.set(key, existing ? merge(existing, event) : event);
  }
  return [...byDestination.values()];
}
