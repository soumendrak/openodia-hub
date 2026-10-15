import { events as curated, type Event } from "../../data/events";
import { EVENT_OVERRIDES } from "../../data/event-overrides";
import {
  applyEventOverrides,
  mergeReviewedCollections,
  resolveEventStatus,
  mergeAliasReviewedEvents,
  sortEventCollection,
} from "../event-lifecycle";
import { dedupeEventsByResolvedUrl } from "../event-url";
import { restoreReviewedEvents } from "../event-reviewed-store";
import { loadEventSnapshot, type EventSnapshot } from "../event-collection";
import { readEventDestinationAliases, storedEventDestination } from "../event-destination-store";

/** One reviewed canonical collection across Worker/TanStack API, search and RSS. */
export async function loadReviewedEventCollection(allowLive = true): Promise<EventSnapshot> {
  const { getEventDatabase } = await import("../event-request-context");
  const db = getEventDatabase();
  const snapshot = await loadEventSnapshot(db, allowLive);
  const { source, sources, databaseReadable } = snapshot;
  let { partial } = snapshot;
  const live = snapshot.events;
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  let collection = mergeReviewedCollections(curated, live, EVENT_OVERRIDES, today);
  if (db && databaseReadable) {
    try {
      collection = (await restoreReviewedEvents(db, collection, () => (partial = true))).map(
        (event) => applyEventOverrides(event, EVENT_OVERRIDES),
      );
    } catch {
      partial = true;
      console.warn("Reviewed event metadata unavailable; retaining checked-in corrections");
    }
  }
  let aliases = new Map<string, string>();
  if (db && databaseReadable) {
    try {
      aliases = await readEventDestinationAliases(db);
    } catch {
      partial = true;
      console.warn("Event destination aliases unavailable; retaining source URLs");
    }
  }
  const destination = (url: string) => storedEventDestination(url, aliases);
  collection = await dedupeEventsByResolvedUrl(
    collection,
    async (url) => destination(url),
    [],
    (previous, next) => mergeAliasReviewedEvents(previous, next, curated, destination),
    true,
  );
  if (db && databaseReadable) {
    try {
      collection = (await restoreReviewedEvents(db, collection, () => (partial = true))).map(
        (event) => applyEventOverrides(event, EVENT_OVERRIDES),
      );
    } catch {
      partial = true;
      console.warn("Canonical reviewed event metadata unavailable; retaining merged corrections");
    }
  }
  return {
    source,
    sources,
    partial,
    events: sortEventCollection(
      collection.map((event) => {
        const reviewed = applyEventOverrides(event, EVENT_OVERRIDES);
        return { ...reviewed, status: resolveEventStatus(reviewed, today) };
      }),
    ),
  };
}
