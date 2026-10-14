import { events as curated, type Event } from "../data/events";
import { fetchLiveEventCollection, CHAPTERS, type LiveEventCollection } from "../routes/api/events";
import { readEventsFromD1, readEventSourceStatuses, type D1Like } from "./events-store";
import { dedupeEventsByResolvedUrl, mergeEventCollectionsByUrl } from "./event-url";
import { mergeNonEmpty } from "./utils";

// Worker requests initialize this isolate's binding, like the shared catalog cache.
let eventDatabase: D1Like | undefined;
export function setEventDatabase(db: D1Like | undefined): void {
  eventDatabase = db;
}

function mergeChronologicalEvents(events: Event[]): Event[] {
  // Merge insertion order places newly discovered events behind the entire
  // curated archive. Order this owned result before API pagination or RSS.
  return mergeEventCollectionsByUrl(curated, events, (previous, incoming) => ({
    ...mergeNonEmpty(previous, incoming),
    community: previous.community,
    organizerId: previous.organizerId,
  })).sort(
    (a, b) =>
      (b.startDate || b.year).localeCompare(a.startDate || a.year) || a.url.localeCompare(b.url),
  );
}

/** One canonical history; source health says nothing about attendance eligibility. */
export async function loadEventCollection(
  db: D1Like | undefined = eventDatabase,
): Promise<LiveEventCollection & { source: "d1" | "scrape" }> {
  if (db) {
    try {
      const events = await dedupeEventsByResolvedUrl(
        await readEventsFromD1(db),
        undefined,
        curated,
      );
      if (events.length) {
        // An older database can serve known records without pretending measured health exists.
        const sources = await readEventSourceStatuses(db).catch(() => []);
        const cutoff = Date.now() - 7 * 60 * 60 * 1000;
        return {
          events: mergeChronologicalEvents(events),
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
    events: mergeChronologicalEvents(live.events),
  };
}
