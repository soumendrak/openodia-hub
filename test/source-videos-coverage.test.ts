import { afterEach, describe, expect, it, vi } from "vitest";

const videoHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({
  fetchWithTimeout: videoHarness.fetch,
  settledValues: (results: PromiseSettledResult<unknown>[]) =>
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
}));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
}));

import { loadVideos, parseRss } from "../src/lib/sources/videos";

const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  videoHarness.fetch.mockReset();
  vi.restoreAllMocks();
  if (originalApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalApiKey;
});

const rss = `<feed>
<entry><yt:videoId>v1</yt:videoId><title>A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39;</title><published>2026-01-01</published></entry>
<entry><title>Missing id</title></entry>
</feed>`;

const rss2 = `<feed>
<entry><yt:videoId>v1</yt:videoId><title>One</title><published>2026-01-01</published></entry>
<entry><yt:videoId>v2</yt:videoId><title>Two</title><published>2026-01-02</published></entry>
</feed>`;

describe("YouTube source adapter", () => {
  it("parses RSS entries and XML entities", () => {
    expect(parseRss(rss, "OpenOdia", "@openodia", "https://youtube.com/@openodia")).toEqual([
      {
        id: "v1",
        title: `A & B <C> "D" 'E'`,
        published: "2026-01-01",
        thumbnail: "https://i.ytimg.com/vi/v1/hqdefault.jpg",
        channelName: "OpenOdia",
        channelHandle: "@openodia",
        channelUrl: "https://youtube.com/@openodia",
      },
    ]);
    expect(parseRss("<feed />", "n", "h", "u")).toEqual([]);
  });

  it("defaults the title to an empty string when an entry has no title tag", () => {
    const rssNoTitle = `<feed><entry><yt:videoId>v9</yt:videoId><published>2026-01-01</published></entry></feed>`;
    expect(parseRss(rssNoTitle, "n", "h", "u")).toEqual([
      {
        id: "v9",
        title: "",
        published: "2026-01-01",
        thumbnail: "https://i.ytimg.com/vi/v9/hqdefault.jpg",
        channelName: "n",
        channelHandle: "h",
        channelUrl: "u",
      },
    ]);
  });

  it("loads channel RSS without requiring a YouTube API key", async () => {
    delete process.env.YOUTUBE_API_KEY;
    videoHarness.fetch.mockImplementation(() =>
      Promise.resolve(new Response(rss, { status: 200 })),
    );
    const channels = await loadVideos();
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.every((channel) => channel.videos[0]?.id === "v1")).toBe(true);
    expect(channels.every((channel) => channel.playlists.length === 0)).toBe(true);
  });

  it("loads playlists and enriches videos with view counts", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss, { status: 200 }));
      if (url.includes("/playlists")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "p1",
                  snippet: {
                    title: "High",
                    description: "d",
                    thumbnails: { high: { url: "high.jpg" } },
                  },
                  contentDetails: { itemCount: 3 },
                },
                {
                  id: "p2",
                  snippet: {
                    title: "Medium",
                    description: "d",
                    thumbnails: { medium: { url: "medium.jpg" } },
                  },
                  contentDetails: { itemCount: 2 },
                },
                {
                  id: "p3",
                  snippet: { title: "Default", description: "d", thumbnails: {} },
                  contentDetails: { itemCount: 1 },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ items: [{ id: "v1", statistics: { viewCount: "42" } }] }), {
          status: 200,
        }),
      );
    });

    const channels = await loadVideos();
    expect(channels[0].videos[0].viewCount).toBe(42);
    expect(channels[0].playlists.map((playlist) => playlist.thumbnail)).toEqual([
      "high.jpg",
      "medium.jpg",
      "",
    ]);
  });

  it("degrades failed RSS, playlist, and statistics calls to empty data", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let rssCalls = 0;
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) {
        rssCalls += 1;
        if (rssCalls === 1) return Promise.reject(new Error("offline"));
        return Promise.resolve(new Response("no", { status: 500 }));
      }
      if (url.includes("/playlists")) return Promise.resolve(new Response("no", { status: 500 }));
      return Promise.reject(new Error("statistics offline"));
    });
    const channels = await loadVideos();
    expect(channels.every((channel) => channel.videos.length === 0)).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("recovers from a rejected playlists call and a rejected statistics batch while sorting multiple videos", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss2, { status: 200 }));
      if (url.includes("/playlists")) return Promise.reject(new Error("playlists offline"));
      return Promise.reject(new Error("statistics offline"));
    });

    const channels = await loadVideos();
    expect(channels.every((channel) => channel.playlists.length === 0)).toBe(true);
    expect(channels.every((channel) => channel.videos.length === 2)).toBe(true);
    expect(
      channels.every((channel) => channel.videos.every((video) => video.viewCount === 0)),
    ).toBe(true);
  });

  it("skips a statistics batch when the response is not ok", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss, { status: 200 }));
      if (url.includes("/playlists")) return Promise.resolve(new Response("no", { status: 500 }));
      return Promise.resolve(new Response("no", { status: 500 }));
    });

    const channels = await loadVideos();
    expect(
      channels.every((channel) => channel.videos.every((video) => video.viewCount === 0)),
    ).toBe(true);
  });

  it("treats a playlists response with no items field as an empty list", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss, { status: 200 }));
      if (url.includes("/playlists"))
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      return Promise.resolve(new Response("no", { status: 500 }));
    });

    const channels = await loadVideos();
    expect(channels.every((channel) => channel.playlists.length === 0)).toBe(true);
  });

  it("treats a statistics response with no items field as empty", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss, { status: 200 }));
      if (url.includes("/playlists")) return Promise.resolve(new Response("no", { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const channels = await loadVideos();
    expect(
      channels.every((channel) => channel.videos.every((video) => video.viewCount === 0)),
    ).toBe(true);
  });

  it("defaults a video's view count to zero when the statistics item omits it", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation((url: string) => {
      if (url.includes("feeds/videos")) return Promise.resolve(new Response(rss, { status: 200 }));
      if (url.includes("/playlists")) return Promise.resolve(new Response("no", { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify({ items: [{ id: "v1", statistics: {} }] }), { status: 200 }),
      );
    });

    const channels = await loadVideos();
    expect(channels.every((channel) => channel.videos[0]?.viewCount === 0)).toBe(true);
  });
});
