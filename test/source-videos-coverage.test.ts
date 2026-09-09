import { afterEach, describe, expect, it, vi } from "vitest";

const videoHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({
  fetchWithTimeout: videoHarness.fetch,
  settledValues: (results: PromiseSettledResult<unknown>[]) =>
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
}));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  UpstreamUnavailableError: class UpstreamUnavailableError extends Error {},
}));

import { channelShells, fetchChannelVideos, loadVideos, parseRss } from "../src/lib/sources/videos";

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

  it("refuses to cache a run that failed everywhere", async () => {
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
    // Every channel failing means YouTube throttled the whole run, not that
    // the community stopped posting. loadVideos throws rather than let that be
    // cached for an hour — the contract loadRepos uses. The retry backoffs
    // spend the fan-out budget along the way, so the tail goes unattempted and
    // the run reports itself incomplete rather than merely empty.
    await expect(loadVideos()).rejects.toThrow("youtube_incomplete");
    expect(warn).toHaveBeenCalled();
  });

  it("retries a feed that rejects, not just one that returns an error status", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const calls = new Map<string, number>();
    videoHarness.fetch.mockImplementation((url: string) => {
      const n = (calls.get(url) ?? 0) + 1;
      calls.set(url, n);
      // A timeout or a dropped connection rejects; it does not resolve with a
      // status. Letting that escape the retry loop abandoned the channel on
      // the first blip, which is how channels went missing from /tutorials.
      if (n === 1) return Promise.reject(new Error("AbortError"));
      return Promise.resolve(new Response(rss, { status: 200 }));
    });

    const channels = await loadVideos();
    expect(channels.every((channel) => channel.videos[0]?.id === "v1")).toBe(true);
    expect([...calls.values()].every((n) => n > 1)).toBe(true);
  });

  it("stops retrying once the fan-out budget is spent", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Every call burns wall-clock and fails, so the budget runs out partway
    // through and the remaining channels are left as shells rather than each
    // adding another round of timeouts to an SSR request.
    videoHarness.fetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response("no", { status: 500 })), 1200),
        ),
    );

    const started = Date.now();
    await expect(loadVideos()).rejects.toThrow("youtube_incomplete");
    const elapsed = Date.now() - started;

    expect(warn).toHaveBeenCalled();
    // Far fewer than channels x attempts, because the budget cut it short.
    expect(videoHarness.fetch.mock.calls.length).toBeLessThan(15);
    // The whole fan-out stays inside the budget plus at most one in-flight
    // request. Checking the deadline only *before* the backoff let a single
    // channel run to ~11.4s under an 8s budget.
    expect(elapsed).toBeLessThan(8000 + 3000 + 1500);
  }, 30_000);

  it("refuses to cache a complete run in which every channel is empty", async () => {
    delete process.env.YOUTUBE_API_KEY;
    // Healthy but empty feeds: every channel is attempted, quickly, and none
    // needs a retry — so the budget survives and this is a real, complete
    // answer of "nothing", which is still not a fact worth caching for an hour.
    videoHarness.fetch.mockImplementation(() =>
      Promise.resolve(new Response("<feed />", { status: 200 })),
    );

    await expect(loadVideos()).rejects.toThrow("youtube_unavailable");
  });

  it("degrades to an empty channel when reading the feed body throws", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // fetchRss swallows its own failures, so the outer catch is reached only by
    // something later — here, a body that cannot be read. It is the last guard
    // that keeps one bad channel from taking down the whole fan-out.
    videoHarness.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.reject(new Error("body stream failed")),
      } as unknown as Response),
    );

    // Called without a deadline, exercising the default budget too.
    const channel = await fetchChannelVideos("h", "N", "https://example.com", "UC0");
    expect(channel).toEqual({
      handle: "h",
      name: "N",
      url: "https://example.com",
      videos: [],
      playlists: [],
    });
    expect(warn).toHaveBeenCalled();
  });

  it("labels a non-Error rejection in the retry log", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    videoHarness.fetch.mockImplementation(() => Promise.reject("just a string"));

    const channel = await fetchChannelVideos("h", "N", "https://example.com", "UC0");
    expect(channel.videos).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("error"));
  });

  it("drops YouTube's no_thumbnail placeholder, which itself 404s", async () => {
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
                    title: "No art",
                    description: "d",
                    thumbnails: { high: { url: "https://i.ytimg.com/img/no_thumbnail.jpg" } },
                  },
                  contentDetails: { itemCount: 1 },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response("no", { status: 500 }));
    });

    const channels = await loadVideos();
    // Treated as absent so the card renders its own placeholder rather than a
    // broken image — the URL YouTube hands back for an artless playlist 404s.
    expect(channels[0].playlists[0].thumbnail).toBe("");
  });

  it("skips the statistics call when no channel returned a video", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    let statsCalls = 0;
    videoHarness.fetch.mockImplementation((url: string) => {
      // Feeds are healthy but empty; playlists are not, so the run is a real
      // result rather than the throttled-everything case.
      if (url.includes("feeds/videos"))
        return Promise.resolve(new Response("<feed />", { status: 200 }));
      if (url.includes("/playlists")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "p1",
                  snippet: { title: "Lessons", description: "d", thumbnails: {} },
                  contentDetails: { itemCount: 4 },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      statsCalls += 1;
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const channels = await loadVideos();
    expect(channels.every((c) => c.videos.length === 0 && c.playlists.length === 1)).toBe(true);
    expect(statsCalls).toBe(0);
  });

  it("makes no request at all once the deadline has already passed", async () => {
    process.env.YOUTUBE_API_KEY = "key";
    videoHarness.fetch.mockImplementation(() =>
      Promise.resolve(new Response(rss, { status: 200 })),
    );

    // Both the feed and the optional playlist metadata are capped by what is
    // left of the budget; with nothing left, neither is worth starting.
    const channel = await fetchChannelVideos(
      "h",
      "N",
      "https://example.com",
      "UC0",
      "key",
      Date.now() - 1,
    );
    expect(channel.videos).toEqual([]);
    expect(channel.playlists).toEqual([]);
    expect(videoHarness.fetch).not.toHaveBeenCalled();
  });

  it("abandons the retry when the first attempt already used up the deadline", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // The request itself outlives the budget, so by the time the retry is
    // considered there is nothing left — checked before the backoff, so the
    // sleep is never even entered.
    videoHarness.fetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response("no", { status: 500 })), 250),
        ),
    );

    const channel = await fetchChannelVideos(
      "h",
      "N",
      "https://example.com",
      "UC0",
      undefined,
      Date.now() + 150,
    );
    expect(channel.videos).toEqual([]);
    expect(videoHarness.fetch).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("abandons the retry when the backoff itself outlives the deadline", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    videoHarness.fetch.mockImplementation(() =>
      Promise.resolve(new Response("no", { status: 500 })),
    );

    // Alive when the first attempt fails, expired by the time the backoff
    // finishes — the recheck that stops a sleep from buying a full-length
    // request it has no budget for. 600ms sits comfortably between an instant
    // mocked failure and the 800ms backoff, so neither a slow CI box nor a
    // fast one moves which branch this lands on.
    const started = Date.now();
    const channel = await fetchChannelVideos(
      "h",
      "N",
      "https://example.com",
      "UC0",
      undefined,
      Date.now() + 600,
    );
    expect(channel.videos).toEqual([]);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(videoHarness.fetch.mock.calls.length).toBeLessThan(3);
    expect(warn).toHaveBeenCalled();
  });

  it("names every configured channel in the shells", () => {
    const shells = channelShells();
    expect(shells.length).toBeGreaterThan(0);
    expect(shells.every((c) => c.url.startsWith("https://") && c.videos.length === 0)).toBe(true);
    expect(shells.map((c) => c.name)).toContain("GDG Cloud Bhubaneswar");
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
