import { applyEventOverrides } from "../../lib/event-lifecycle";
import { EVENT_OVERRIDES } from "../../data/event-overrides";
import { createFileRoute } from "@tanstack/react-router";
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

function formatHumanDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const day = d.getUTCDate();
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
    const month = monthNames[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "";
  }
}

async function readChapterEvents(
  organizerIdentity: string,
  slug: string,
  signal: AbortSignal,
): Promise<Event[]> {
  try {
    const organizer = resolveOrganizer(organizerIdentity);
    const community = organizer?.canonicalName ?? organizerIdentity;
    const response = await fetch(`https://gdg.community.dev/${slug}/`, {
      signal,
      // A configured chapter must return its own data. Do not let implicit
      // redirect chains consume the scheduled external-request budget.
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch Bevy page for slug: ${slug}, Status: ${response.status}`);
      throw new Error(`Chapter HTTP ${response.status}`);
    }
    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) {
      console.warn(`No React hydrated state script found for slug: ${slug}`);
      throw new Error("Missing chapter state");
    }
    const data = JSON.parse(match[1]);
    const pageProps = data?.props?.pageProps;
    if (!pageProps?.prerenderData) {
      throw new Error("Missing chapter prerender data");
    }

    if (
      !Array.isArray(pageProps.prerenderData.upcomingEvents?.results) ||
      !Array.isArray(pageProps.prerenderData.pastEvents?.results)
    ) {
      throw new Error("Malformed chapter event collections");
    }

    const upcomingResults: BevyEvent[] = pageProps.prerenderData.upcomingEvents.results;
    const pastResults: BevyEvent[] = pageProps.prerenderData.pastEvents.results;

    const rawEvents = [...upcomingResults, ...pastResults];

    return dedupeEventsByUrl(
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
          description: item.description_short || item.description || "",
        };
      }),
    );
  } catch (err) {
    console.error(`Error fetching Bevy events for chapter ${slug}:`, err);
    throw err;
  }
}

export type ChapterOutcome = {
  events: Event[];
  status: { outcome: "success-empty" | "success-events" | "failed" };
};

/** Preserve an empty success separately from HTTP, network, parse and body timeouts. */
export async function fetchChapterOutcome(
  organizerIdentity: string,
  slug: string,
  timeoutMs = 8000,
): Promise<ChapterOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const events = await Promise.race([
      readChapterEvents(organizerIdentity, slug, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Chapter response timed out"));
        }, timeoutMs);
      }),
    ]);
    return { events, status: { outcome: events.length ? "success-events" : "success-empty" } };
  } catch {
    return { events: [], status: { outcome: "failed" } };
  } finally {
    clearTimeout(timer);
  }
}

/** Compatibility wrapper; collection consumers retain the source outcome. */
export async function fetchChapterEvents(
  organizerIdentity: string,
  slug: string,
): Promise<Event[]> {
  return (await fetchChapterOutcome(organizerIdentity, slug)).events;
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const { loadReviewedEventCollection } = await import("../../lib/sources/events");
          const { events: allEvents, partial } = await loadReviewedEventCollection();

          const url = new URL(request.url);
          const pageParam = url.searchParams.get("page");

          if (pageParam === null) {
            return new Response(JSON.stringify({ events: allEvents, partial }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": partial
                  ? "no-store"
                  : "public, s-maxage=3600, stale-while-revalidate=600",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, User-Agent",
              },
            });
          }

          const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50);
          const pageNum = parseInt(pageParam || "1", 10) || 1;
          const start = (pageNum - 1) * limit;
          const pageItems = allEvents.slice(start, start + limit);
          const nextCursor = start + limit < allEvents.length ? String(pageNum + 1) : undefined;

          return new Response(
            JSON.stringify({
              events: pageItems,
              nextCursor,
              total: allEvents.length,
              partial,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": partial
                  ? "no-store"
                  : "public, s-maxage=3600, stale-while-revalidate=600",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, User-Agent",
              },
            },
          );
        } catch (e) {
          console.error("Live events ingestion error:", e);
          return new Response(JSON.stringify({ events: [] }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
            },
          });
        }
      },
    },
  },
});
