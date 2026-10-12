import { events as curated, type Event } from "../../data/events";
import { EVENT_OVERRIDES } from "../../data/event-overrides";
import {
  applyEventOverrides,
  mergeReviewedCollections,
  resolveEventStatus,
} from "../event-lifecycle";
import { restoreReviewedEvents } from "../event-reviewed-store";
import { readEventsFromD1 } from "../events-store";
import { settledValues } from "../fetch-utils";
import { CHAPTERS, fetchChapterEvents } from "../../routes/api/events";

/** One reviewed canonical collection across Worker/TanStack API, search and RSS. */
export async function loadReviewedEventCollection(allowLive = true): Promise<{
  events: Event[];
  source: "d1" | "scrape";
}> {
  const { getEventDatabase } = await import("../event-request-context");
  const db = getEventDatabase();
  let persisted: Event[] = [];
  let source: "d1" | "scrape" = "scrape";
  if (db) {
    try {
      persisted = await readEventsFromD1(db);
      if (persisted.length) source = "d1";
    } catch {
      console.warn("Event persistence unavailable; using checked-in and live records");
    }
  }
  const live =
    source === "d1"
      ? persisted
      : !allowLive
        ? []
        : settledValues(
            await Promise.allSettled(
              CHAPTERS.map((chapter) =>
                fetchChapterEvents(chapter.organizerId ?? chapter.community, chapter.slug),
              ),
            ),
          ).flat();
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  let collection = mergeReviewedCollections(curated, live, EVENT_OVERRIDES, today);
  if (db) {
    try {
      collection = (await restoreReviewedEvents(db, collection)).map((event) =>
        applyEventOverrides(event, EVENT_OVERRIDES),
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/no such table.*event_reviewed_metadata/i.test(error.message)
      )
        throw error;
      console.warn("Reviewed event metadata unavailable; retaining checked-in corrections");
    }
  }
  return {
    source,
    events: collection.map((event) => ({ ...event, status: resolveEventStatus(event, today) })),
  };
}
