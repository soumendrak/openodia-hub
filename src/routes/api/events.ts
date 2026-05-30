import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout, settledValues } from "../../lib/fetch-utils";
import type { Event, EventType } from "../../data/events/types";

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

export const CHAPTERS = [
  {
    community: "GDG Bhubaneswar",
    slug: "gdg-bhubaneswar",
  },
  {
    community: "GDGoC NIST Berhampur",
    slug: "gdg-on-campus-national-institute-of-science-and-technology-berhampur-india",
  },
  {
    community: "GDGoC KIIT",
    slug: "gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india",
  },
  {
    community: "GDGoC CVR University",
    slug: "gdg-on-campus-c-v-raman-global-university-bhubaneswar-india",
  },
  {
    community: "GDGoC IIIT Bhubaneswar",
    slug: "gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india",
  },
  {
    community: "GDGoC ITER SOA",
    slug: "gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india",
  },
];

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

export async function fetchChapterEvents(community: string, slug: string): Promise<Event[]> {
  try {
    const response = await fetchWithTimeout(`https://gdg.community.dev/${slug}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch Bevy page for slug: ${slug}, Status: ${response.status}`);
      return [];
    }
    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) {
      console.warn(`No React hydrated state script found for slug: ${slug}`);
      return [];
    }
    const data = JSON.parse(match[1]);
    const pageProps = data?.props?.pageProps;
    if (!pageProps?.prerenderData) {
      return [];
    }

    const upcomingResults: BevyEvent[] = pageProps.prerenderData.upcomingEvents?.results || [];
    const pastResults: BevyEvent[] = pageProps.prerenderData.pastEvents?.results || [];

    const rawEvents = [...upcomingResults, ...pastResults];

    return rawEvents.map((item) => {
      const startStr = item.start_date ? item.start_date.split("T")[0] : "";
      const year = startStr ? startStr.split("-")[0] : new Date().getFullYear().toString();
      const date = item.start_date ? formatHumanDate(item.start_date) : "";

      return {
        year,
        date,
        title: item.title,
        url: item.cohost_registration_url || item.url,
        type: mapEventType(item.event_type_title || "Talk"),
        community,
        startDate: startStr,
        endDate: startStr,
        description: item.description_short || item.description || "",
      };
    });
  } catch (err) {
    console.error(`Error fetching Bevy events for chapter ${slug}:`, err);
    return [];
  }
}

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const results = await Promise.allSettled(
            CHAPTERS.map((ch) => fetchChapterEvents(ch.community, ch.slug)),
          );
          const allEvents = settledValues(results).flat();

          const url = new URL(request.url);
          const pageParam = url.searchParams.get("page");

          if (pageParam === null) {
            return new Response(JSON.stringify({ events: allEvents }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
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
