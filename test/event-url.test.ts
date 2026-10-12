import { describe, expect, it, vi } from "vitest";
import {
  dedupeEventsByResolvedUrl,
  dedupeEventsByUrl,
  eventUrlKey,
  mergeEventCollectionsByUrl,
  resolveEventDestinationUrl,
} from "../src/lib/event-url";

describe("eventUrlKey", () => {
  it("canonicalizes chapter-specific GDG cohost destinations", () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    expect(eventUrlKey(`${base}/cohost-gdg-bhubaneswar/`)).toBe(`${base}`);
    expect(eventUrlKey(`${base}/cohost-gdg-on-campus-kiit`)).toBe(`${base}`);
  });

  it("ignores fragments, tracking parameters, query order, and trailing slashes", () => {
    expect(eventUrlKey("https://example.com/event/?b=2&utm_source=gdg&a=1#tickets")).toBe(
      "https://example.com/event?a=1&b=2",
    );
  });

  it("does not strip cohost-like paths on unrelated domains", () => {
    expect(eventUrlKey("https://example.com/event/cohost-special")).toBe(
      "https://example.com/event/cohost-special",
    );
  });

  it("normalizes malformed and root URLs without throwing", () => {
    expect(eventUrlKey("  not a URL/#section/  ")).toBe("not a URL");
    expect(eventUrlKey("https://example.com/#section")).toBe("https://example.com/");
  });
});

describe("dedupeEventsByUrl", () => {
  it("keeps the first event for each destination address", () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    const first = { title: "Shared event", url: `${base}/cohost-gdg-bhubaneswar` };
    const duplicate = { title: "Shared event edited", url: `${base}/cohost-gdg-kiit` };

    expect(dedupeEventsByUrl([first, duplicate])).toEqual([first]);
  });
});

describe("redirect-aware event deduplication", () => {
  const current =
    "https://gdg.community.dev/events/details/google-gdg-cloud-bhubaneswar-presents-code-for-communities-20/";
  const legacy =
    "https://gdg.community.dev/events/details/google-gdg-cloud-bhubaneswar-presents-learn-with-communities-bhubaneswar-2026/cohost-gdg-bhubaneswar";

  it("collapses the exact September 13 stale D1 alias and keeps current metadata", async () => {
    const resolve = async (url: string) => (url === legacy ? current : url);
    const stale = {
      title: "Learn with Communities Bhubaneswar 2026",
      url: legacy,
      startDate: "2026-09-13",
    };
    const latest = {
      title: "Code for Communities 2.0",
      url: current,
      startDate: "2026-09-13",
    };

    await expect(dedupeEventsByResolvedUrl([stale, latest], resolve)).resolves.toEqual([latest]);
  });

  it("retains distinct same-date destinations and skips lookups for unique dates", async () => {
    const resolve = vi.fn(async (url: string) => url);
    const collision = [
      { url: "https://example.com/one", startDate: "2026-05-28" },
      { url: "https://example.com/two", startDate: "2026-05-28" },
      { url: "https://example.com/unique", startDate: "2026-06-01" },
    ];

    await expect(dedupeEventsByResolvedUrl(collision, resolve)).resolves.toEqual(collision);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("falls back from startDate to date, and then to an empty key, when grouping", async () => {
    const resolve = vi.fn(async (url: string) => url);
    const items = [
      { url: "https://example.com/date-a", date: "2026-04-01" },
      { url: "https://example.com/date-b", date: "2026-04-01" },
      { url: "https://example.com/no-date-a" },
      { url: "https://example.com/no-date-b" },
    ];

    await expect(dedupeEventsByResolvedUrl(items, resolve)).resolves.toEqual(items);
    expect(resolve).toHaveBeenCalledTimes(4);
  });

  it("keeps the first indirect winner when a later duplicate is also not the direct destination", async () => {
    const canonical = "https://example.com/canonical";
    const resolve = vi.fn(async () => canonical);
    const items = [
      { title: "First", url: "https://example.com/alias-1", startDate: "2026-04-10" },
      { title: "Second", url: "https://example.com/alias-2", startDate: "2026-04-10" },
    ];

    await expect(dedupeEventsByResolvedUrl(items, resolve)).resolves.toEqual([
      { title: "First", url: canonical, startDate: "2026-04-10" },
    ]);
  });

  it("resolves manual redirect locations without depending on a runtime rewriting Response.url", async () => {
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => new Response(url));
    // Response.url is readonly in Node; a controlled descriptor represents the final HTTP request.
    fetcher.mockImplementation(async (url: string) => {
      const r = new Response(
        null,
        url === legacy ? { status: 302, headers: { location: current } } : {},
      );
      Object.defineProperty(r, "url", { value: url });
      return r;
    });
    expect(await resolveEventDestinationUrl(legacy, fetcher as typeof fetch)).toBe(current);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetcher.mock.calls[0][1]?.signal).toBe(fetcher.mock.calls[1][1]?.signal);
  });
  it("bounds redirect loops/chains and rejects missing or unsafe locations", async () => {
    for (const location of [
      null,
      "https://[invalid",
      "https://example.org/outside",
      "http://gdg.community.dev/events/details/unsafe",
      "https://user@gdg.community.dev/events/details/unsafe",
      "https://:secret@gdg.community.dev/events/details/unsafe",
    ]) {
      const fetcher = vi.fn(
        async () => new Response(null, { status: 302, headers: location ? { location } : {} }),
      );
      expect(await resolveEventDestinationUrl(legacy, fetcher as typeof fetch)).toBe(legacy);
    }
    const loop = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: legacy } }),
    );
    expect(await resolveEventDestinationUrl(legacy, loop as typeof fetch)).toBe(legacy);
    expect(loop).toHaveBeenCalledTimes(1);
    let count = 0;
    const chain = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: `/events/details/hop-${++count}` },
        }),
    );
    expect(await resolveEventDestinationUrl(legacy, chain as typeof fetch)).toBe(legacy);
    expect(chain).toHaveBeenCalledTimes(5);
  });
  it("follows only successful redirects that remain GDG event-detail URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: current } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(resolveEventDestinationUrl(legacy, fetcher as typeof fetch)).resolves.toBe(
      current,
    );
    expect(fetcher).toHaveBeenCalledWith(
      legacy,
      expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    );

    await expect(
      resolveEventDestinationUrl(
        legacy,
        vi.fn().mockResolvedValue({
          ok: false,
          url: "https://gdg.community.dev/gdg-bhubaneswar/",
        }) as typeof fetch,
      ),
    ).resolves.toBe(legacy);
    await expect(
      resolveEventDestinationUrl(
        legacy,
        vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch,
      ),
    ).resolves.toBe(legacy);
  });

  it("treats an unparsable URL as not a GDG event URL rather than throwing", async () => {
    const fetcher = vi.fn();
    await expect(resolveEventDestinationUrl("not a url", fetcher as typeof fetch)).resolves.toBe(
      "not a url",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reuses the cached destination for a repeated lookup on the same URL", async () => {
    const collision = [
      { url: "https://example.com/cache-target-one", startDate: "2026-08-20" },
      { url: "https://example.com/cache-target-two", startDate: "2026-08-20" },
    ];

    // No custom resolver: exercises the module's own memoizing default,
    // whose cache-hit branch only fires on a second lookup within the TTL.
    await dedupeEventsByResolvedUrl(collision);
    await expect(dedupeEventsByResolvedUrl(collision)).resolves.toEqual(collision);
  });
});

describe("mergeEventCollectionsByUrl", () => {
  it("merges matching live metadata and appends a new destination", () => {
    const archived = [{ title: "Archived", url: "https://example.com/event/" }];
    const live = [
      { title: "Current", url: "https://example.com/event#registration" },
      { title: "New", url: "https://example.com/new" },
    ];
    expect(
      mergeEventCollectionsByUrl(archived, live, (oldEvent, liveEvent) => ({
        ...oldEvent,
        title: liveEvent.title,
      })),
    ).toEqual([
      { title: "Current", url: "https://example.com/event/" },
      { title: "New", url: "https://example.com/new" },
    ]);
  });
});
