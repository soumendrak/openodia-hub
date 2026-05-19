import { createFileRoute } from "@tanstack/react-router";

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  viewCount?: number;
};

type Playlist = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
};

type ChannelResult = {
  handle: string;
  name: string;
  url: string;
  videos: Video[];
  playlists: Playlist[];
};

const CHANNELS: { handle: string; name: string; url: string; channelId?: string }[] = [
  { handle: "OdiaGenAI", name: "OdiaGenAI", url: "https://www.youtube.com/@OdiaGenAI", channelId: "UCZsktbZ-Tu2QdFhTBYFQcsg", },
  {
    handle: "openodia",
    name: "OpenOdia",
    url: "https://www.youtube.com/@openodia",
    channelId: "UCMiaqPIaXo19LuQx0zbEFAA",
  },
  { handle: "OdiasInML", name: "Odias in ML", url: "https://www.youtube.com/@OdiasInML", channelId: "UCaoGfM_49C8kcKqyTh-fr6Q" },
];

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function resolveChannelId(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; openodia.com)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"channelId":"(UC[^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parseRss(
  xml: string,
  channelName: string,
  channelHandle: string,
  channelUrl: string,
): Video[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries
    .map((entry) => {
      const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) ?? [])[1] ?? "";
      const rawTitle = (entry.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
      const title = decodeXmlEntities(rawTitle);
      const published = (entry.match(/<published>([^<]+)<\/published>/) ?? [])[1] ?? "";
      if (!id) return null;
      return {
        id,
        title,
        published,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        channelName,
        channelHandle,
        channelUrl,
      };
    })
    .filter(Boolean) as Video[];
}

async function fetchPlaylists(channelId: string, apiKey: string): Promise<Playlist[]> {
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=12&key=${apiKey}`;
    const res = await fetch(url, { headers: { "User-Agent": "openodia.com" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        id: string;
        snippet: {
          title: string;
          description: string;
          thumbnails: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
          };
        };
        contentDetails: { itemCount: number };
      }[];
    };
    return (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail:
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        "",
      itemCount: item.contentDetails.itemCount,
    }));
  } catch {
    return [];
  }
}

async function fetchChannelVideos(
  handle: string,
  name: string,
  url: string,
  knownChannelId?: string,
  apiKey?: string,
): Promise<ChannelResult> {
  const channelId = knownChannelId ?? (await resolveChannelId(handle));
  if (!channelId) return { handle, name, url, videos: [], playlists: [] };

  const [rssRes, playlists] = await Promise.all([
    fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": "openodia.com" },
    }),
    apiKey ? fetchPlaylists(channelId, apiKey) : Promise.resolve([]),
  ]);

  if (!rssRes.ok) return { handle, name, url, videos: [], playlists };

  const xml = await rssRes.text();
  const videos = parseRss(xml, name, handle, url).slice(0, 15);
  return { handle, name, url, videos, playlists };
}

async function enrichWithViewCounts(
  channels: ChannelResult[],
  apiKey: string,
): Promise<ChannelResult[]> {
  const allIds = channels.flatMap((c) => c.videos.map((v) => v.id));
  if (allIds.length === 0) return channels;

  const viewCounts = new Map<string, number>();

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}&key=${apiKey}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "openodia.com" } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        items?: { id: string; statistics: { viewCount?: string } }[];
      };
      for (const item of data.items ?? []) {
        viewCounts.set(item.id, parseInt(item.statistics.viewCount ?? "0", 10));
      }
    } catch {
      continue;
    }
  }

  return channels.map((channel) => ({
    ...channel,
    videos: channel.videos
      .map((v) => ({ ...v, viewCount: viewCounts.get(v.id) ?? 0 }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 8),
    playlists: channel.playlists,
  }));
}

export const Route = createFileRoute("/api/videos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const apiKey = process.env.YOUTUBE_API_KEY;
          let channels = await Promise.all(
            CHANNELS.map((c) =>
              fetchChannelVideos(c.handle, c.name, c.url, c.channelId, apiKey),
            ),
          );

          if (apiKey) {
            channels = await enrichWithViewCounts(channels, apiKey);
          }

          return new Response(JSON.stringify({ channels }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
          });
        } catch (e) {
          console.error("videos error", e);
          return Response.json({ channels: [] }, { status: 200 });
        }
      },
    },
  },
});
