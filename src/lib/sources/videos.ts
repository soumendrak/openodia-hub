/**
 * YouTube channel videos and playlists for the Odia AI community channels.
 *
 * Lives outside the route file so both `/api/videos` and the /tutorials route
 * loader (SSR) read the same data through the same cache — the same split as
 * repos.ts and awesome.ts. Before this, /tutorials fetched on the client only,
 * so the page a crawler or an answer engine saw had no videos in it at all.
 */
import { fetchWithTimeout, settledValues } from "../fetch-utils";
import { CHANNELS } from "../../data/channels";
import { cachedJson } from "./cache";

export type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  viewCount?: number;
};

export type Playlist = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
};

export type ChannelResult = {
  handle: string;
  name: string;
  url: string;
  videos: Video[];
  playlists: Playlist[];
};

const TTL_MS = 60 * 60 * 1000;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseRss(
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
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=12&key=${apiKey}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "openodia.com" } });
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
  channelId: string,
  apiKey?: string,
): Promise<ChannelResult> {
  const empty: ChannelResult = { handle, name, url, videos: [], playlists: [] };
  try {
    const [rssRes, playlists] = await Promise.all([
      fetchWithTimeout(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        headers: { "User-Agent": "openodia.com" },
      }),
      apiKey ? fetchPlaylists(channelId, apiKey) : Promise.resolve([]),
    ]);

    if (!rssRes.ok) return { ...empty, playlists };

    const xml = await rssRes.text();
    const videos = parseRss(xml, name, handle, url).slice(0, 15);
    return { handle, name, url, videos, playlists };
  } catch (err) {
    console.warn(`fetchChannelVideos ${handle}:`, err);
    return empty;
  }
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
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}&key=${apiKey}`;
    try {
      const res = await fetchWithTimeout(url, { headers: { "User-Agent": "openodia.com" } });
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

export async function loadVideos(): Promise<ChannelResult[]> {
  return cachedJson("videos", TTL_MS, async () => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const settled = await Promise.allSettled(
      CHANNELS.map((c) => fetchChannelVideos(c.handle, c.name, c.url, c.channelId, apiKey)),
    );
    const channels = settledValues(settled);
    return apiKey ? enrichWithViewCounts(channels, apiKey) : channels;
  });
}
