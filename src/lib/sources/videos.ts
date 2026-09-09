/**
 * YouTube channel videos and playlists for the Odia AI community channels.
 *
 * Lives outside the route file so both `/api/videos` and the /tutorials route
 * loader (SSR) read the same data through the same cache — the same split as
 * repos.ts and awesome.ts. Before this, /tutorials fetched on the client only,
 * so the page a crawler or an answer engine saw had no videos in it at all.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { CHANNELS } from "../../data/channels";
import { cachedJson, UpstreamUnavailableError } from "./cache";

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

function usableThumbnail(t: {
  high?: { url: string };
  medium?: { url: string };
  default?: { url: string };
}): string {
  const url = t.high?.url ?? t.medium?.url ?? t.default?.url ?? "";
  return url.includes("no_thumbnail") ? "" : url;
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
      // YouTube hands back i.ytimg.com/img/no_thumbnail.jpg for a playlist with
      // no artwork — and that URL itself 404s. Treat it as absent so the card's
      // own placeholder renders instead of a broken image.
      thumbnail: usableThumbnail(item.snippet.thumbnails),
      itemCount: item.contentDetails.itemCount,
    }));
  } catch {
    return [];
  }
}

/**
 * YouTube's RSS endpoint answers a burst of requests from one IP with HTTP 500
 * rather than 429 — measured here, five simultaneous feeds returned four 500s
 * and the same five spaced a second apart returned five 200s. A failed feed is
 * indistinguishable from an empty channel downstream, so the channel simply
 * vanished from /tutorials for the hour the empty result stayed cached. One
 * retry after a short pause is enough; the fan-out is also throttled below.
 */
const RSS_ATTEMPTS = 3;
const RSS_BACKOFF_MS = 400;

async function fetchRss(channelId: string): Promise<Response | null> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const init = { headers: { "User-Agent": "openodia.com" } };
  const statuses: number[] = [];

  for (let attempt = 0; attempt < RSS_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RSS_BACKOFF_MS * 2 ** attempt));
    const res = await fetchWithTimeout(url, init);
    if (res.ok) return res;
    statuses.push(res.status);
  }

  console.warn(`youtube rss ${channelId}: ${statuses.join(", ")}`);
  return null;
}

export async function fetchChannelVideos(
  handle: string,
  name: string,
  url: string,
  channelId: string,
  apiKey?: string,
): Promise<ChannelResult> {
  const empty: ChannelResult = { handle, name, url, videos: [], playlists: [] };
  try {
    const [rssRes, playlists] = await Promise.all([
      fetchRss(channelId),
      apiKey ? fetchPlaylists(channelId, apiKey) : Promise.resolve([]),
    ]);

    if (!rssRes) return { ...empty, playlists };

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
    // One at a time, not all five: see the note on fetchRss. Cold cost is a
    // couple of seconds for the whole set, paid once an hour behind
    // stale-while-revalidate, and /tutorials renders a skeleton meanwhile.
    const channels: ChannelResult[] = [];
    for (const c of CHANNELS) {
      channels.push(await fetchChannelVideos(c.handle, c.name, c.url, c.channelId, apiKey));
    }
    // Every channel empty means YouTube throttled the whole run, not that the
    // community stopped posting. Throwing keeps that out of the hour-long
    // cache — the same contract loadRepos uses — so the stale result stays up
    // and the next reader retries instead of seeing an empty page.
    if (channels.every((c) => c.videos.length === 0 && c.playlists.length === 0)) {
      throw new UpstreamUnavailableError("youtube_unavailable");
    }
    return apiKey ? enrichWithViewCounts(channels, apiKey) : channels;
  });
}
