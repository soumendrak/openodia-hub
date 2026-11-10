import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "../src/lib/sources/catalog";
import type { Paper } from "../src/lib/sources/papers";
import type { ChannelResult } from "../src/lib/sources/videos";
import type { Event } from "../src/data/events";

const apiHarness = vi.hoisted(() => ({ snapshot: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("../src/lib/sources/search", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/sources/search")>();
  return { ...original, loadSearchSnapshot: apiHarness.snapshot };
});

type SearchRoute = {
  options: {
    server: { handlers: { GET: (input: { request: Request }) => Promise<Response> } };
  };
};

const catalog: CatalogEntry[] = [
  {
    key: "/r/gh/openodia/toolkit",
    kind: "gh",
    name: "OpenOdia Toolkit",
    author: "openodia",
    url: "https://github.com/openodia/toolkit",
    permalink: "/r/gh/openodia/toolkit",
    description: "Odia text utilities",
    license: "MIT",
    task: "text-processing",
    category: "Libraries",
    language: "TypeScript",
    tags: ["odia"],
    sources: ["github"],
  },
  {
    key: "/r/model/openodia/ocr",
    kind: "model",
    name: "Odia OCR Model",
    author: "openodia",
    url: "https://huggingface.co/openodia/ocr",
    permalink: "/r/model/openodia/ocr",
    description: "Reads Odia documents",
    license: "apache-2.0",
    task: "image-to-text",
    tags: ["or"],
    sources: ["huggingface"],
  },
  {
    key: "/r/dataset/openodia/corpus",
    kind: "dataset",
    name: "Odia Corpus",
    author: "openodia",
    url: "https://huggingface.co/datasets/openodia/corpus",
    permalink: "/r/dataset/openodia/corpus",
    description: "A text corpus",
    license: "cc-by-4.0",
    task: "language-modeling",
    tags: ["language:or"],
    sources: ["huggingface"],
  },
  {
    key: "https://example.com/keyboard",
    kind: "link",
    name: "Odia Keyboard",
    author: "community",
    url: "https://example.com/keyboard",
    description: "Input tool",
    license: "Unknown",
    task: "input",
    tags: ["typing"],
    sources: ["catalog"],
  },
];

const papers: Paper[] = [
  {
    id: "paper-1",
    title: "Odia NLP Survey",
    authors: ["Ada Researcher"],
    year: 2026,
    venue: "ACL",
    url: "https://example.com/paper",
    abstract: "A survey of Odia NLP.",
    openAccess: true,
    tasks: ["Corpora & resources"],
    sources: ["openalex"],
  },
];

const channels: ChannelResult[] = [
  {
    handle: "@openodia",
    name: "OpenOdia",
    url: "https://youtube.com/@openodia",
    playlists: [],
    videos: [
      {
        id: "video-1",
        title: "Build an Odia tokenizer",
        published: "2026-01-01",
        thumbnail: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
        channelName: "OpenOdia",
        channelHandle: "@openodia",
        channelUrl: "https://youtube.com/@openodia",
      },
    ],
  },
];

const liveEvents: Event[] = [
  {
    year: "2026",
    date: "1 Oct 2026",
    title: "Odia AI Meetup Fixture",
    url: "https://example.com/meetup-fixture",
    type: "Talk",
    community: "OpenOdia",
    description: "A fixture event beyond the curated list.",
  },
];

const loaders = {
  catalog: vi.fn(async () => catalog),
  papers: vi.fn(async () => papers),
  videos: vi.fn(async () => channels),
  events: vi.fn(async () => liveEvents),
};

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("search snapshot adapters", () => {
  it("collects fulfilled chapter event results while tolerating a failed chapter", async () => {
    const { loadLiveSearchEvents } = await import("../src/lib/sources/search");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(liveEvents)
      .mockRejectedValueOnce(new Error("chapter offline"));
    const chapters = [
      { community: "One", slug: "one" },
      { community: "Two", slug: "two" },
    ];

    await expect(loadLiveSearchEvents(fetcher, chapters)).resolves.toEqual(liveEvents);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retains checked-in event search results when the live loader rejects entirely", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const snapshot = await buildSearchSnapshot({
      ...loaders,
      events: async () => {
        throw new Error("event source unavailable");
      },
    });
    expect(snapshot.sources).toContainEqual(
      expect.objectContaining({ source: "events", status: "partial" }),
    );
    expect(snapshot.documents.some((document) => document.kind === "event")).toBe(true);
  });

  it("keeps healthy event search results while exposing measured partial source state", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const snapshot = await buildSearchSnapshot({
      ...loaders,
      events: async () => ({ events: liveEvents, sources: [], partial: true }),
    });
    expect(snapshot.sources).toContainEqual(
      expect.objectContaining({ source: "events", status: "partial" }),
    );
    expect(snapshot.documents).toContainEqual(
      expect.objectContaining({ id: `event:${liveEvents[0].url}` }),
    );
  });

  it("maps every supported dynamic kind with stable internal destinations", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const snapshot = await buildSearchSnapshot(loaders);
    const fixtureDocuments = snapshot.documents.filter(
      (document) =>
        document.id.includes("openodia") ||
        document.id.includes("paper-1") ||
        document.id.includes("video-1") ||
        document.id.includes("meetup-fixture") ||
        document.id.includes("keyboard"),
    );

    expect(new Set(snapshot.documents.map((document) => document.kind))).toEqual(
      new Set(["page", "repository", "tool", "model", "dataset", "paper", "tutorial", "event"]),
    );
    expect(fixtureDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "repository", href: "/r/gh/openodia/toolkit" }),
        expect.objectContaining({ kind: "tool", externalHref: "https://example.com/keyboard" }),
        expect.objectContaining({ kind: "model", href: "/r/model/openodia/ocr" }),
        expect.objectContaining({ kind: "dataset", href: "/r/dataset/openodia/corpus" }),
        expect.objectContaining({ kind: "paper", href: expect.stringContaining("/papers?q=") }),
        expect.objectContaining({
          kind: "tutorial",
          href: expect.stringContaining("/tutorials?q="),
        }),
        expect.objectContaining({ kind: "event", href: expect.stringContaining("/events?q=") }),
      ]),
    );
    expect(snapshot.sources.every((source) => source.status === "ready")).toBe(true);
    expect(snapshot.builtAt).toEqual(expect.any(String));
  });

  it("keeps healthy sources when individual loaders fail and reports partial state", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const snapshot = await buildSearchSnapshot({
      ...loaders,
      catalog: vi.fn(async () => {
        throw new Error("catalog offline");
      }),
      papers: vi.fn(async () => {
        throw new Error("papers offline");
      }),
      videos: vi.fn(async () => {
        throw new Error("videos offline");
      }),
    });

    expect(snapshot.documents.some((document) => document.kind === "page")).toBe(true);
    expect(snapshot.documents.some((document) => document.kind === "event")).toBe(true);
    expect(snapshot.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "catalog", status: "unavailable", count: 0 }),
        expect.objectContaining({ source: "papers", status: "unavailable", count: 0 }),
        expect.objectContaining({ source: "videos", status: "unavailable", count: 0 }),
        expect.objectContaining({ source: "events", status: "ready", count: expect.any(Number) }),
      ]),
    );
  });

  it("keeps the curated archive and healthy catalog when live event discovery rejects", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const snapshot = await buildSearchSnapshot({
      ...loaders,
      events: async () => {
        throw new Error("event source unavailable");
      },
    });
    expect(snapshot.documents.some((document) => document.kind === "event")).toBe(true);
    expect(
      snapshot.documents.some((document) => document.id === `event:${liveEvents[0].url}`),
    ).toBe(false);
    expect(snapshot.documents.some((document) => document.kind === "model")).toBe(true);
    expect(snapshot.sources).toContainEqual(
      expect.objectContaining({
        source: "events",
        status: "partial",
        count: expect.any(Number),
      }),
    );
  });
  it("deduplicates curated and live events by canonical URL", async () => {
    const { buildSearchSnapshot } = await import("../src/lib/sources/search");
    const duplicate = { ...liveEvents[0], title: "Duplicate title" };
    const snapshot = await buildSearchSnapshot({
      ...loaders,
      events: vi.fn(async () => [duplicate, duplicate]),
    });
    expect(
      snapshot.documents.filter((document) => document.id === `event:${duplicate.url}`),
    ).toHaveLength(1);
  });

  it("reuses the search snapshot cache instead of repeating source fan-out", async () => {
    const { createSearchSnapshotLoader } = await import("../src/lib/sources/search");
    const cachedLoaders = {
      catalog: vi.fn(async () => catalog),
      papers: vi.fn(async () => papers),
      videos: vi.fn(async () => channels),
      events: vi.fn(async () => liveEvents),
    };
    const load = createSearchSnapshotLoader(
      cachedLoaders,
      `search-snapshot:test:${Date.now()}:${Math.random()}`,
    );

    const first = await load();
    const second = await load();
    expect(second).toBe(first);
    for (const loader of Object.values(cachedLoaders)) expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("search snapshot cache with D1 bound", () => {
  it("memoizes the D1-backed snapshot per database instead of rebuilding per search", async () => {
    const { createSearchSnapshotLoader } = await import("../src/lib/sources/search");
    const { withEventDatabase } = await import("../src/lib/event-request-context");
    const events = vi.fn(async () => liveEvents);
    const load = createSearchSnapshotLoader(
      {
        catalog: vi.fn(async () => catalog),
        papers: vi.fn(async () => papers),
        videos: vi.fn(async () => channels),
        events,
      },
      `search-snapshot:test-d1:${Date.now()}:${Math.random()}`,
    );
    const db = { prepare: vi.fn() } as never;
    const first = await withEventDatabase(db, () => load());
    const second = await withEventDatabase(db, () => load());
    expect(second).toBe(first);
    expect(events).toHaveBeenCalledTimes(1);
    await load();
    expect(events).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the D1-backed snapshot once the snapshot TTL has passed", async () => {
    const { createSearchSnapshotLoader, SEARCH_SNAPSHOT_TTL_MS } =
      await import("../src/lib/sources/search");
    const { withEventDatabase } = await import("../src/lib/event-request-context");
    const events = vi.fn(async () => liveEvents);
    const load = createSearchSnapshotLoader(
      {
        catalog: vi.fn(async () => catalog),
        papers: vi.fn(async () => papers),
        videos: vi.fn(async () => channels),
        events,
      },
      `search-snapshot:test-d1-ttl:${Date.now()}:${Math.random()}`,
    );
    const db = { prepare: vi.fn() } as never;
    const start = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    const first = await withEventDatabase(db, () => load());
    now.mockReturnValue(start + SEARCH_SNAPSHOT_TTL_MS - 1);
    expect(await withEventDatabase(db, () => load())).toBe(first);
    now.mockReturnValue(start + SEARCH_SNAPSHOT_TTL_MS);
    expect(await withEventDatabase(db, () => load())).not.toBe(first);
    expect(events).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});

describe("search API contract", () => {
  async function handler() {
    const route = await import("../src/routes/api/search");
    return (route.Route as unknown as SearchRoute).options.server.handlers.GET;
  }

  it.each(["translate", "translation", "Odia contributor"])(
    "finds the translation contributor page for %s from the static snapshot inventory",
    async (query) => {
      const { buildSearchSnapshot } = await import("../src/lib/sources/search");
      const snapshot = await buildSearchSnapshot(loaders);
      apiHarness.snapshot.mockResolvedValueOnce(snapshot);
      const get = await handler();
      const response = await get({
        request: new Request(
          `https://openodia.com/api/search?q=${encodeURIComponent(query)}&kind=page`,
        ),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).results).toContainEqual(
        expect.objectContaining({
          kind: "page",
          title: "Help translate OpenOdia",
          href: "/translation-status",
          source: "pages",
        }),
      );
    },
  );

  it("validates queries, kinds, and limits", async () => {
    const get = await handler();
    expect((await get({ request: new Request("https://openodia.com/api/search") })).status).toBe(
      400,
    );
    expect(
      (await get({ request: new Request(`https://openodia.com/api/search?q=${"x".repeat(81)}`) }))
        .status,
    ).toBe(400);
    expect(
      (await get({ request: new Request("https://openodia.com/api/search?q=odia&kind=bad") }))
        .status,
    ).toBe(400);

    apiHarness.snapshot.mockResolvedValueOnce({
      documents: Array.from({ length: 80 }, (_, index) => ({
        id: `model:${index}`,
        kind: "model",
        title: `Odia model ${index}`,
        summary: "Odia model",
        source: "fixture",
      })),
      sources: [{ source: "fixture", status: "ready", count: 80 }],
      builtAt: "2026-09-21T00:00:00.000Z",
    });
    const response = await get({
      request: new Request("https://openodia.com/api/search?q=odia&kind=model&limit=999"),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).results).toHaveLength(50);
  });

  it("exposes partial source state and a bounded cacheable response", async () => {
    const get = await handler();
    apiHarness.snapshot.mockResolvedValueOnce({
      documents: [
        { id: "paper:1", kind: "paper", title: "Odia Survey", summary: "NLP", source: "papers" },
      ],
      sources: [
        { source: "papers", status: "ready", count: 1 },
        { source: "videos", status: "unavailable", count: 0 },
      ],
      builtAt: "2026-09-21T00:00:00.000Z",
    });
    const response = await get({
      request: new Request("https://openodia.com/api/search?q=survey&limit=not-a-number"),
    });
    const body = await response.json();
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(body).toMatchObject({ partial: true, builtAt: "2026-09-21T00:00:00.000Z" });
    expect(body.results).toHaveLength(1);
  });

  it("returns a typed 503 when the snapshot service fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const get = await handler();
    apiHarness.snapshot.mockRejectedValueOnce(new Error("all sources unavailable"));
    const response = await get({
      request: new Request("https://openodia.com/api/search?q=odia"),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "upstream_unavailable",
      reason: "all sources unavailable",
    });
  });
});
