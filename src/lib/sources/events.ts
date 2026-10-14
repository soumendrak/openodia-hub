import { events as curated, type Event } from "../../data/events";
import { EVENT_OVERRIDES } from "../../data/event-overrides";
import {
  applyEventOverrides,
  mergeReviewedCollections,
  resolveEventStatus,
  mergeReviewedEvents,
  sortEventCollection,
} from "../event-lifecycle";
import { dedupeEventsByResolvedUrl } from "../event-url";
import { restoreReviewedEvents } from "../event-reviewed-store";
import { readEventsFromD1 } from "../events-store";
import { readEventDestinationAliases, storedEventDestination } from "../event-destination-store";
import { CHAPTERS, fetchChapterOutcome } from "../../routes/api/events";

/** One reviewed canonical collection across Worker/TanStack API, search and RSS. */
export async function loadReviewedEventCollection(allowLive = true): Promise<{
  events: Event[];
  source: "d1" | "scrape";
  partial: boolean;
}> {
  const { getEventDatabase } = await import("../event-request-context");
  const db = getEventDatabase();
  let persisted: Event[] = [];
  let source: "d1" | "scrape" = "scrape";
  let partial = false;
  let databaseReadable = true;
  if (db) {
    try {
      persisted = await readEventsFromD1(db);
      if (persisted.length) source = "d1";
    } catch {
      databaseReadable = false;
      partial = true;
      console.warn("Event persistence unavailable; using checked-in and live records");
    }
  }
  let live = persisted;
  if (source !== "d1" && allowLive) {
    const outcomes = await Promise.allSettled(
      CHAPTERS.map((chapter) =>
        fetchChapterOutcome(chapter.organizerId ?? chapter.community, chapter.slug),
      ),
    );
    partial ||= outcomes.some(
      (outcome) => outcome.status === "rejected" || outcome.value.status.outcome === "failed",
    );
    live = outcomes.flatMap((outcome) =>
      outcome.status === "fulfilled" ? outcome.value.events : [],
    );
  }
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
  collection = await dedupeEventsByResolvedUrl(
    collection,
    async (url) => storedEventDestination(url, aliases),
    mergeReviewedEvents,
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
    partial,
    events: sortEventCollection(
      collection.map((event) => {
        const reviewed = applyEventOverrides(event, EVENT_OVERRIDES);
        return { ...reviewed, status: resolveEventStatus(reviewed, today) };
      }),
    ),
  };
}
