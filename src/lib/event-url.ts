import type { Event } from "../data/events/types";

const TRACKING_QUERY_PARAMS = new Set(["dclid", "fbclid", "gclid", "mc_cid", "mc_eid", "msclkid"]);

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
