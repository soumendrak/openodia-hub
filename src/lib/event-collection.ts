import { events as curated } from "../data/events";
import { fetchLiveEventCollection, CHAPTERS, type LiveEventCollection } from "../routes/api/events";
import { readEventsFromD1, readEventSourceStatuses, type D1Like } from "./events-store";
import { mergeEventCollectionsByUrl } from "./event-url";
import { mergeNonEmpty } from "./utils";

// Same request-scoped Worker binding setup pattern as the shared catalog cache.
let eventDatabase: D1Like | undefined;
export function setEventDatabase(db: D1Like | undefined): void {
  eventDatabase = db;
}

/** One canonical history; source health says nothing about attendance eligibility. */
export async function loadEventCollection(
  db: D1Like | undefined = eventDatabase,
): Promise<LiveEventCollection & { source: "d1" | "scrape" }> {
  if (db) {
    try {
      const events = await readEventsFromD1(db);
      if (events.length) {
        // An older database can serve known records without pretending measured health exists.
        const sources = await readEventSourceStatuses(db).catch(() => []);
        const cutoff = Date.now() - 7 * 60 * 60 * 1000;
        return {
          events: mergeEventCollectionsByUrl(curated, events, mergeNonEmpty),
          sources,
          source: "d1",
          partial:
            sources.length !== CHAPTERS.length ||
            sources.some(
              (status) =>
                status.outcome === "failed" ||
                !status.upcomingComplete ||
                !status.pastComplete ||
                !Number.isFinite(Date.parse(status.lastAttemptAt)) ||
                Date.parse(status.lastAttemptAt) < cutoff,
            ),
        };
      }
    } catch {
      // Persistence unavailable: preserve checked-in history and measured live outcomes.
    }
  }
  const live = await fetchLiveEventCollection();
  return {
    ...live,
    source: "scrape",
    events: mergeEventCollectionsByUrl(curated, live.events, mergeNonEmpty),
  };
}
