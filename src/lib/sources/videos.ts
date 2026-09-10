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

async function fetchPlaylists(
  channelId: string,
  apiKey: string,
  timeoutMs: number,
): Promise<Playlist[]> {
  try {
    // No budget guard here: addPlaylists is the only caller and it already
    // breaks before spending one it hasn't got.
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=12&key=${apiKey}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": "openodia.com" } },
      timeoutMs,
    );
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
 * vanished from /tutorials for the hour the empty result stayed cached.
 *
 * Hence: one channel at a time, and a couple of retries each. Both cost
 * wall-clock on a cold cache, so the whole fan-out runs against a budget —
 * a stalled upstream must not hold an SSR request open for the sum of five
 * timeouts. The RSS timeout is well under the 8s default for the same reason.
 */
const RSS_ATTEMPTS = 3;
const RSS_BACKOFF_MS = 400;
const RSS_TIMEOUT_MS = 3000;
const FANOUT_BUDGET_MS = 8000;

async function fetchRss(channelId: string, deadline: number): Promise<Response | null> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const init = { headers: { "User-Agent": "openodia.com" } };
  const outcomes: string[] = [];

  for (let attempt = 0; attempt < RSS_ATTEMPTS; attempt++) {
    // Always take one shot; only the retries are rationed by the budget. The
    // deadline is rechecked *after* the backoff too — sleeping past it and
    // then starting a full-length request is how three stalled attempts added
    // up to ~11.4s under an 8s budget.
    if (attempt > 0) {
      if (Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, RSS_BACKOFF_MS * 2 ** attempt));
      if (Date.now() >= deadline) break;
    }
    const budget = Math.min(RSS_TIMEOUT_MS, deadline - Date.now());
    if (budget <= 0) break;
    try {
      const res = await fetchWithTimeout(url, init, budget);
      if (res.ok) return res;
      outcomes.push(String(res.status));
    } catch (err) {
      // A network error or an aborted timeout rejects rather than returning a
      // response. Swallowing it here is what makes the retry a retry — letting
      // it escape would abandon the remaining attempts on the first blip.
      outcomes.push(err instanceof Error ? err.name : "error");
    }
  }

  console.warn(`youtube rss ${channelId}: ${outcomes.join(", ")}`);
  return null;
}

/** A channel with nothing loaded — still a real destination, with a real link. */
function emptyChannel(handle: string, name: string, url: string): ChannelResult {
  return { handle, name, url, videos: [], playlists: [] };
}

/** Every configured channel as an empty shell, for when the fetch is hopeless. */
export function channelShells(): ChannelResult[] {
  return CHANNELS.map((c) => emptyChannel(c.handle, c.name, c.url));
}

/**
 * One channel's feed. Videos only — playlists are fetched in a later pass, on
 * whatever budget the feeds leave behind. Running them together meant a slow
 * playlist call spent the time the *next* channel's feed needed, so five
 * healthy feeds could still end as a 503 because the optional metadata beside
 * them was slow.
 */
export async function fetchChannelVideos(
  handle: string,
  name: string,
  url: string,
  channelId: string,
  deadline: number = Date.now() + FANOUT_BUDGET_MS,
): Promise<ChannelResult> {
  const empty = emptyChannel(handle, name, url);
  try {
    const rssRes = await fetchRss(channelId, deadline);
    if (!rssRes) return empty;

    const xml = await rssRes.text();
    const videos = parseRss(xml, name, handle, url).slice(0, 15);
    return { handle, name, url, videos, playlists: [] };
  } catch (err) {
    console.warn(`fetchChannelVideos ${handle}:`, err);
    return empty;
  }
}

/**
 * Playlists for every channel, in place, on the budget the feeds left over.
 * Optional metadata: a channel with none still renders, so this stops the
 * moment there is no time rather than borrowing from anything essential.
 */
export async function addPlaylists(
  channels: ChannelResult[],
  apiKey: string,
  deadline: number,
): Promise<void> {
  for (let i = 0; i < channels.length; i++) {
    const budget = Math.min(RSS_TIMEOUT_MS, deadline - Date.now());
    if (budget <= 0) break;
    const channelId = CHANNELS.find((c) => c.handle === channels[i].handle)?.channelId;
    if (!channelId) continue;
    channels[i].playlists = await fetchPlaylists(channelId, apiKey, budget);
  }
}

/**
 * View counts are ordering metadata, nothing more: without them the videos
 * still render, just in feed order. So this runs on whatever is left of the
 * fan-out budget and stops when that is gone — five channels of 15 videos is
 * two sequential batches, which on the default timeout could add ~16s to a
 * request that was already capped at 8s.
 */
export async function enrichWithViewCounts(
  channels: ChannelResult[],
  apiKey: string,
  deadline: number,
): Promise<ChannelResult[]> {
  const allIds = channels.flatMap((c) => c.videos.map((v) => v.id));
  if (allIds.length === 0) return channels;

  const viewCounts = new Map<string, number>();

  for (let i = 0; i < allIds.length; i += 50) {
    const budget = Math.min(RSS_TIMEOUT_MS, deadline - Date.now());
    if (budget <= 0) break;
    const batch = allIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}&key=${apiKey}`;
    try {
      const res = await fetchWithTimeout(
        url,
        { headers: { "User-Agent": "openodia.com" } },
        budget,
      );
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
    // One at a time, not all five: see the note on fetchRss. Healthy, that is
    // ~2s for the whole set, paid once an hour behind stale-while-revalidate.
    // Once the budget is spent the rest are left as shells rather than adding
    // another timeout each — the page still lists every channel and its link.
    const deadline = Date.now() + FANOUT_BUDGET_MS;

    // Pass 1 — the feeds, which are the page. Nothing optional runs until
    // every one of these has had its turn.
    const channels: ChannelResult[] = [];
    let skipped = 0;
    for (const c of CHANNELS) {
      if (Date.now() >= deadline) {
        skipped++;
        channels.push(emptyChannel(c.handle, c.name, c.url));
        continue;
      }
      channels.push(await fetchChannelVideos(c.handle, c.name, c.url, c.channelId, deadline));
    }

    // Two ways this run is not a fact about the ecosystem:
    //
    //   - every channel came back empty, which means YouTube throttled the
    //     whole run rather than that the community stopped posting;
    //   - the budget ran out before every channel was even attempted, so the
    //     tail is missing for a reason that has nothing to do with the tail.
    //
    // Either way, throwing keeps it out of the hour-long cache — the contract
    // loadRepos uses. Stale-while-revalidate then keeps serving the last
    // complete result instead of overwriting it with a worse one.
    if (skipped > 0) {
      console.warn(`youtube fan-out: budget spent, ${skipped} channel(s) unattempted`);
      throw new UpstreamUnavailableError("youtube_incomplete");
    }
    if (channels.every((c) => c.videos.length === 0)) {
      throw new UpstreamUnavailableError("youtube_unavailable");
    }

    // Passes 2 and 3 — playlists, then view counts. Both are enrichment, both
    // run only on what the feeds left, and the result is complete without
    // either of them.
    if (!apiKey) return channels;
    await addPlaylists(channels, apiKey, deadline);
    return enrichWithViewCounts(channels, apiKey, deadline);
  });
}
