import { createFileRoute } from "@tanstack/react-router";
import { events as staticEvents } from "../data/events";
import { fetchChapterEvents, CHAPTERS } from "./api/events";
import { settledValues } from "../lib/fetch-utils";
import type { Event } from "../data/events/types";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function safeCdata(content: string): string {
  return `<![CDATA[${content.replace(/]]>/g, "]]&gt;")}]]>`;
}

function getISTDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatRfc822Date(dateStr?: string, year?: string): string {
  if (!dateStr) {
    return new Date().toUTCString();
  }

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toUTCString();
    }
  } catch {
    // Fallback if parsing fails
  }

  if (year) {
    const parsedYear = parseInt(year, 10);
    if (!isNaN(parsedYear)) {
      return new Date(parsedYear, 0, 1).toUTCString();
    }
  }

  return new Date().toUTCString();
}

function generateRssFeed(events: Event[], baseUrl: string): string {
  const lastBuildDate = new Date().toUTCString();

  const items = events
    .map((e) => {
      const title = escapeXml(e.title || "Untitled Event");
      const link = escapeXml(e.url || baseUrl + "/events");
      const guid = escapeXml(e.url || `${baseUrl}/events#${e.title}-${e.startDate}`);
      const pubDate = formatRfc822Date(e.startDate || e.date, e.year);
      const category = escapeXml(e.type || "Talk");
      const community = escapeXml(e.community || "Odia AI Community");

      const descriptionContent = [
        e.description ? `<p>${e.description}</p>` : "",
        e.location ? `<p><strong>Location:</strong> ${e.location}</p>` : "",
        e.date ? `<p><strong>Date:</strong> ${e.date}</p>` : "",
        e.theme ? `<p><strong>Theme:</strong> <em>&ldquo;${e.theme}&rdquo;</em></p>` : "",
        `<p><strong>Organized by:</strong> ${community}</p>`,
      ]
        .filter(Boolean)
        .join("\n");

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="${e.url ? "true" : "false"}">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <description>${safeCdata(descriptionContent)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Odia AI Community Events</title>
    <link>${baseUrl}/events</link>
    <description>Past and upcoming events from the Odia AI ecosystem — conferences, workshops, and summits.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/events-feed" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

export const Route = createFileRoute("/events-feed")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Fetch dynamic events
          const results = await Promise.allSettled(
            CHAPTERS.map((ch) => fetchChapterEvents(ch.community, ch.slug)),
          );
          const fetchedEvents = settledValues(results).flat();

          // Merge static and dynamic events
          const allMergedEventsMap = new Map<string, Event>();

          staticEvents.forEach((e) => {
            allMergedEventsMap.set(e.url, e);
          });

          fetchedEvents.forEach((e) => {
            const existing = allMergedEventsMap.get(e.url);
            if (existing) {
              allMergedEventsMap.set(e.url, {
                ...existing,
                ...e,
              });
            } else {
              allMergedEventsMap.set(e.url, e);
            }
          });

          const today = getISTDateString();
          const mergedEventsList = Array.from(allMergedEventsMap.values())
            .map((e) => {
              let status = e.status;
              if (e.startDate) {
                const end = e.endDate || e.startDate;
                if (today < e.startDate) {
                  status = "upcoming";
                } else if (today >= e.startDate && today <= end) {
                  status = "live";
                } else {
                  status = undefined; // past event
                }
              }
              return { ...e, status };
            })
            .sort((a, b) => {
              const yearDiff = Number(b.year) - Number(a.year);
              if (yearDiff !== 0) return yearDiff;
              if (a.startDate && b.startDate) {
                return b.startDate.localeCompare(a.startDate);
              }
              if (a.startDate) return -1;
              if (b.startDate) return 1;
              return 0;
            });

          const baseUrl = "https://openodia.com";
          const xml = generateRssFeed(mergedEventsList, baseUrl);

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/rss+xml; charset=utf-8",
              "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
            },
          });
        } catch (e) {
          console.error("RSS feed generation error:", e);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
