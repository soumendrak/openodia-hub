import { events as curated, type Event } from "../data/events";
import { fetchLiveEventCollection, CHAPTERS, type LiveEventCollection } from "../routes/api/events";
import { readEventsFromD1, readEventSourceStatuses, type D1Like } from "./events-store";
import { dedupeEventsByResolvedUrl, mergeEventCollectionsByUrl } from "./event-url";
import { getEventDatabase } from "./event-request-context";
import { mergeNonEmpty } from "./utils";

export type EventSnapshot = LiveEventCollection & { source: "d1" | "scrape" };

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

/**
 * Persisted (or, when D1 is absent, empty or unreadable, live) records with
 * measured source health. Records are not merged with the curated archive.
 * `allowLive: false` never scrapes; it returns no records instead.
 */
export async function loadEventSnapshot(
  db: D1Like | undefined = getEventDatabase(),
  allowLive = true,
): Promise<EventSnapshot & { databaseReadable: boolean }> {
  let databaseReadable = true;
  if (db) {
    try {
      const events = await readEventsFromD1(db);
      // An older database can serve known records without pretending measured health exists.
      const sources = await readEventSourceStatuses(db).catch(() => []);
      // A measured empty snapshot (no source reported events) is authoritative:
      // serve the curated archive with it instead of re-scraping every source.
      // Every current chapter must have a status; an aborted first sync is not.
      const measuredEmpty =
        CHAPTERS.every((chapter) => sources.some((status) => status.sourceId === chapter.slug)) &&
        sources.every((status) => status.outcome !== "success-events");
      if (events.length || measuredEmpty) {
        const cutoff = Date.now() - 7 * 60 * 60 * 1000;
        return {
          events,
          sources,
          source: "d1",
          databaseReadable,
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
      databaseReadable = false;
      console.warn("Event persistence unavailable; using checked-in and live records");
    }
  }
  if (!allowLive) {
    return {
      events: [],
      sources: [],
      partial: !databaseReadable,
      source: "scrape",
      databaseReadable,
    };
  }
  const live = await fetchLiveEventCollection();
  return {
    ...live,
    partial: live.partial || !databaseReadable,
    source: "scrape",
    databaseReadable,
  };
}

/** One canonical history; source health says nothing about attendance eligibility. */
export async function loadEventCollection(
  db: D1Like | undefined = getEventDatabase(),
): Promise<EventSnapshot> {
  const { events, sources, partial, source } = await loadEventSnapshot(db);
  const deduped =
    source === "d1" ? await dedupeEventsByResolvedUrl(events, undefined, curated) : events;
  return { events: mergeChronologicalEvents(deduped), sources, partial, source };
}
