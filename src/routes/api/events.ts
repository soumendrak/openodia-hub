import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";
import { dedupeEventsByUrl } from "../../lib/event-url";
import type { Event, EventType } from "../../data/events/types";
import { getOrganizerById, resolveOrganizer, type OrganizerId } from "../../data/organizers";

type BevyEvent = {
  cohost_registration_url?: string;
  cropped_banner_url?: string;
  cropped_picture_url?: string;
  description: string;
  description_short?: string;
  event_type_title: string;
  start_date: string;
  title: string;
  url: string;
};

export type EventChapter = {
  organizerId?: OrganizerId;
  /** Kept for existing injected adapters; canonical values are registry-derived. */
  community: string;
  slug: string;
};

const chapterDefinitions: readonly { organizerId: OrganizerId; slug: string }[] = [
  {
    organizerId: "gdg-bhubaneswar",
    slug: "gdg-bhubaneswar",
  },
  {
    organizerId: "gdgoc-nist-berhampur",
    slug: "gdg-on-campus-national-institute-of-science-and-technology-berhampur-india",
  },
  {
    organizerId: "gdgoc-kiit",
    slug: "gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india",
  },
  {
    organizerId: "gdgoc-cvr",
    slug: "gdg-on-campus-c-v-raman-global-university-bhubaneswar-india",
  },
  {
    organizerId: "gdgoc-iter-soa",
    slug: "gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india",
  },
];

export const CHAPTERS: readonly EventChapter[] = chapterDefinitions.map((chapter) => ({
  ...chapter,
  community: getOrganizerById(chapter.organizerId).canonicalName,
}));

function mapEventType(title: string): EventType {
  const t = title.toLowerCase();
  if (t.includes("hackathon")) return "Hackathon";
  if (t.includes("conference") || t.includes("summit")) return "Conference";
  if (t.includes("workshop") || t.includes("study") || t.includes("bootcamp")) return "Workshop";
  if (t.includes("talk") || t.includes("session") || t.includes("meetup") || t.includes("speaker"))
    return "Talk";
  if (t.includes("research")) return "Research";
  return "Talk";
}

// The adapter validates the date before formatting; missing dates remain blank.
function formatHumanDate(isoStr: string): string {
  const date = new Date(isoStr);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

type BevyEventList = { count?: unknown; links?: { next?: unknown } | null; results?: unknown };

/** One chapter page, with whether each Bevy list holds every event it counts. */
export type ChapterSnapshot = {
  events: Event[];
  upcomingComplete: boolean;
  pastComplete: boolean;
};

// Bevy pages a list (e.g. 4 of 87 past events with `links.next` set). Only a
// list whose `count` exactly matches its results and that has no next page is complete, so an
// empty list is a real zero only when its count is 0.
function isCompleteList(list: BevyEventList, results: unknown[]): boolean {
  return (
    typeof list.count === "number" &&
    Number.isInteger(list.count) &&
    list.count >= 0 &&
    // A count below results.length is a malformed contract, not a snapshot.
    results.length === list.count &&
    !list.links?.next
  );
}

/** Accepts only `YYYY-MM-DD…` starts whose calendar date really exists. */
function isIsoStart(value: string): boolean {
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(day) &&
    new Date(day).toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

/** Bevy descriptions are untyped; only non-empty strings may reach search indexing. */
function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && !!value) ?? "";
}

/** Reads a chapter page, rejecting when it cannot be read or has an unexpected shape. */
export async function fetchChapterSnapshot(
  organizerIdentity: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ChapterSnapshot> {
  const organizer = resolveOrganizer(organizerIdentity);
  const community = organizer?.canonicalName ?? organizerIdentity;
  const chapterFetch = signal ? fetch : fetchWithTimeout;
  const response = await chapterFetch(`https://gdg.community.dev/${slug}/`, {
    ...(signal ? { signal } : {}),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new EventSourceError("http");
  }
  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error(`No React hydrated state script found for slug: ${slug}`);
  }
  const data = JSON.parse(match[1]);
  const pageProps = data?.props?.pageProps;
  if (!pageProps?.prerenderData) {
    throw new Error(`No prerender data found for slug: ${slug}`);
  }

  // Both collections must be present: a renamed or missing list is a page-shape
  // change, not a chapter with no events, so it must not count as success.
  const collections: BevyEvent[][] = [];
  const complete: boolean[] = [];
  for (const key of ["upcomingEvents", "pastEvents"] as const) {
    const list: BevyEventList = pageProps.prerenderData[key] ?? {};
    if (!Array.isArray(list.results)) {
      throw new Error(`prerenderData.${key}.results missing for slug: ${slug}`);
    }
    if (
      list.results.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          typeof item.title !== "string" ||
          (item.url !== undefined && typeof item.url !== "string") ||
          (item.start_date !== undefined && typeof item.start_date !== "string") ||
          (item.event_type_title !== undefined && typeof item.event_type_title !== "string") ||
          (item.start_date && !isIsoStart(item.start_date)),
      )
    ) {
      throw new Error("Unexpected event record shape");
    }
    collections.push(list.results);
    complete.push(
      isCompleteList(list, list.results) &&
        list.results.every((item) => item.url?.trim() && item.start_date),
    );
  }

  // Records without a URL have no identity; drop them before URL dedup. Their
  // list is already marked incomplete above, so no deactivation follows.
  const rawEvents = collections.flat().filter((item) => !!item.url?.trim());

  const events = dedupeEventsByUrl(
    rawEvents.map((item) => {
      const startStr = item.start_date ? item.start_date.split("T")[0] : "";
      const year = startStr ? startStr.split("-")[0] : new Date().getFullYear().toString();
      const date = item.start_date ? formatHumanDate(item.start_date) : "";

      return {
        year,
        date,
        title: item.title,
        // Bevy's canonical event URL is stable across chapter/cohost pages.
        // A cohost registration URL is an alias, not the event identity.
        url: item.url,
        type: mapEventType(item.event_type_title || "Talk"),
        community,
        ...(organizer ? { organizerId: organizer.id } : {}),
        startDate: startStr,
        endDate: startStr,
        description: firstString(item.description_short, item.description),
      };
    }),
  );
  return { events, upcomingComplete: complete[0], pastComplete: complete[1] };
}

export type EventSourceStatus = {
  sourceId: string;
  outcome: "success-empty" | "success-events" | "failed";
  eventCount: number;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  errorCategory?: "http" | "timeout" | "parse" | "network";
  upcomingComplete: boolean;
  pastComplete: boolean;
};

export type EventSourceOutcome = ChapterSnapshot & { status: EventSourceStatus };
class EventSourceError extends Error {
  constructor(readonly category: NonNullable<EventSourceStatus["errorCategory"]>) {
    super(category);
  }
}

/** Bounds the entire adapter, including response.text(), not only headers. */
export async function fetchChapterOutcome(
  organizerIdentity: string,
  slug: string,
  timeoutMs = 8000,
): Promise<EventSourceOutcome> {
  const lastAttemptAt = new Date().toISOString();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    const snapshot = await Promise.race([
      fetchChapterSnapshot(organizerIdentity, slug, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new EventSourceError("timeout"));
        }, timeoutMs);
      }),
    ]);
    return {
      ...snapshot,
      status: {
        sourceId: slug,
        outcome: snapshot.events.length ? "success-events" : "success-empty",
        eventCount: snapshot.events.length,
        lastAttemptAt,
        lastSuccessAt: new Date().toISOString(),
        upcomingComplete: snapshot.upcomingComplete,
        pastComplete: snapshot.pastComplete,
      },
    };
  } catch (error) {
    const category =
      error instanceof EventSourceError
        ? error.category
        : error instanceof SyntaxError
          ? "parse"
          : (error instanceof Error || error instanceof DOMException) && error.name === "AbortError"
            ? "timeout"
            : error instanceof TypeError
              ? "network"
              : "parse";
    return {
      events: [],
      upcomingComplete: false,
      pastComplete: false,
      status: {
        sourceId: slug,
        outcome: "failed",
        eventCount: 0,
        lastAttemptAt,
        errorCategory: category,
        upcomingComplete: false,
        pastComplete: false,
      },
    };
  } finally {
    clearTimeout(timer!);
  }
}

/** Compatibility adapter; aggregation consumers use the measured outcome instead. */
export async function fetchChapterEvents(
  organizerIdentity: string,
  slug: string,
): Promise<Event[]> {
  return (await fetchChapterOutcome(organizerIdentity, slug)).events;
}

export type LiveEventCollection = {
  events: Event[];
  sources: EventSourceStatus[];
  partial: boolean;
};
export async function fetchLiveEventCollection(): Promise<LiveEventCollection> {
  const outcomes = await Promise.all(
    CHAPTERS.map((chapter) =>
      fetchChapterOutcome(chapter.organizerId ?? chapter.community, chapter.slug),
    ),
  );
  return {
    events: dedupeEventsByUrl(outcomes.flatMap((outcome) => outcome.events)),
    sources: outcomes.map((outcome) => outcome.status),
    partial: outcomes.some(
      (outcome) =>
        outcome.status.outcome === "failed" || !outcome.pastComplete || !outcome.upcomingComplete,
    ),
  };
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const { loadEventCollection } = await import("../../lib/event-collection");
          const collection = await loadEventCollection();
          const url = new URL(request.url);
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
          const limit = Math.max(
            1,
            Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50),
          );
          const start = (page - 1) * limit;
          const paginated = url.searchParams.has("page");
          return Response.json(
            {
              ...collection,
              events: paginated ? collection.events.slice(start, start + limit) : collection.events,
              total: collection.events.length,
              // Year facets cover the whole corpus so unvisited pages stay selectable.
              years: [...new Set(collection.events.map((event) => event.year))],
              nextCursor:
                paginated && start + limit < collection.events.length
                  ? String(page + 1)
                  : undefined,
            },
            {
              status:
                collection.events.length === 0 &&
                collection.sources.every((s) => s.outcome === "failed")
                  ? 503
                  : 200,
              headers: {
                "Cache-Control": collection.partial
                  ? "no-store"
                  : "public, s-maxage=3600, stale-while-revalidate=600",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, User-Agent",
              },
            },
          );
        } catch {
          console.error("Live events ingestion error");
          return Response.json(
            { events: [], partial: true, sources: [] },
            {
              status: 500,
              headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
