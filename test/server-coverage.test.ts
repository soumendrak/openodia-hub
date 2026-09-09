import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverHarness = vi.hoisted(() => ({
  entryFetch: vi.fn(),
  setCacheStore: vi.fn(),
  setExecutionContext: vi.fn(),
  awesome: vi.fn(),
  repos: vi.fn(),
  models: vi.fn(),
  datasets: vi.fn(),
  readEvents: vi.fn(),
  syncEvents: vi.fn(),
  chapterEvents: vi.fn(),
  capturedError: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: serverHarness.entryFetch },
}));
vi.mock("../src/lib/error-capture", () => ({
  consumeLastCapturedError: serverHarness.capturedError,
}));
vi.mock("../src/lib/sources/cache", () => ({
  setCacheStore: serverHarness.setCacheStore,
  setExecutionContext: serverHarness.setExecutionContext,
}));
vi.mock("../src/lib/sources/awesome", () => ({ loadAwesome: serverHarness.awesome }));
vi.mock("../src/lib/sources/repos", () => ({ loadRepos: serverHarness.repos }));
vi.mock("../src/lib/sources/huggingface", () => ({
  loadModels: serverHarness.models,
  loadDatasets: serverHarness.datasets,
}));
vi.mock("../src/lib/events-store", () => ({
  readEventsFromD1: serverHarness.readEvents,
  syncEventsToD1: serverHarness.syncEvents,
}));
vi.mock("../src/routes/api/events", () => ({
  CHAPTERS: [
    { community: "One", slug: "one" },
    { community: "Two", slug: "two" },
  ],
  fetchChapterEvents: serverHarness.chapterEvents,
}));

import server from "../src/server";

const event = {
  title: "Event",
  url: "https://example.com/event",
  community: "One",
  type: "Talk" as const,
  date: "1 Jan 2026",
  year: "2026",
  startDate: "2026-01-01",
  description: "Description",
};

const event2 = { ...event, url: "https://example.com/event-2" };
const event3 = { ...event, url: "https://example.com/event-3" };

// `new Response(string)` auto-sets a `text/plain` content-type, so a response
// with truly NO content-type header (to exercise `?? ""` fallbacks) has to
// have that default header stripped back off.
function responseWithoutContentType(body: BodyInit | null, init?: ResponseInit): Response {
  const response = new Response(body, init);
  response.headers.delete("content-type");
  return response;
}

beforeEach(() => {
  serverHarness.entryFetch.mockResolvedValue(
    new Response("<html><head><title>Page</title></head><body><h1>Hello</h1></body></html>", {
      headers: { "content-type": "text/html" },
    }),
  );
  serverHarness.awesome.mockResolvedValue([]);
  serverHarness.repos.mockResolvedValue([]);
  serverHarness.models.mockResolvedValue({ items: [], truncated: false });
  serverHarness.datasets.mockResolvedValue({ items: [], truncated: false });
  serverHarness.chapterEvents.mockResolvedValue([]);
  serverHarness.readEvents.mockResolvedValue([]);
  serverHarness.syncEvents.mockResolvedValue({ upserted: 2 });
  serverHarness.capturedError.mockReturnValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Worker-owned endpoints and rewrites", () => {
  it("serves cached and warming contributor payloads", async () => {
    const cached = JSON.stringify({ contributors: [{ login: "odia" }], totalContributors: 1 });
    const kv = { get: vi.fn().mockResolvedValue(cached) };
    const response = await server.fetch(
      new Request("https://openodia.com/api/contributors"),
      { CONTRIBUTORS_KV: kv },
      { waitUntil: vi.fn() },
    );
    expect(await response.json()).toEqual({
      contributors: [{ login: "odia" }],
      totalContributors: 1,
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");

    const warming = await server.fetch(
      new Request("https://openodia.com/api/contributors"),
      undefined,
      {},
    );
    expect(await warming.json()).toMatchObject({ error: "warming_up", contributors: [] });
  });

  it("redirects projects and serves both well-known documents", async () => {
    const redirect = await server.fetch(
      new Request("https://openodia.com/projects"),
      undefined,
      {},
    );
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("https://openodia.com/tools");

    const manifest = await server.fetch(
      new Request("https://openodia.com/.well-known/ai-plugin.json"),
      undefined,
      {},
    );
    expect(await manifest.json()).toMatchObject({
      name_for_model: "openodia",
      auth: { type: "none" },
    });

    const openapi = await server.fetch(
      new Request("https://openodia.com/.well-known/openapi.json"),
      undefined,
      {},
    );
    const spec = await openapi.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.paths["/api/resources"]).toBeDefined();
  });

  it.each([
    ["/llms.txt", "/llms/txt"],
    ["/llms-full.txt", "/llms-full/txt"],
    ["/sitemap.xml", "/sitemap/xml"],
  ])("rewrites %s before SSR", async (incoming, rewritten) => {
    await server.fetch(new Request(`https://openodia.com${incoming}`), undefined, {});
    expect(serverHarness.entryFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: `https://openodia.com${rewritten}` }),
      undefined,
      {},
    );
  });

  it("negotiates markdown while asking SSR for HTML", async () => {
    const response = await server.fetch(
      new Request("https://openodia.com/about", { headers: { accept: "text/markdown" } }),
      undefined,
      {},
    );
    expect(serverHarness.entryFetch.mock.calls[0][0].headers.get("accept")).toBe("text/html");
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("# Hello");
  });

  it("adds agent links to ordinary HTML but not JSON", async () => {
    const html = await server.fetch(new Request("https://openodia.com/about"), undefined, {});
    expect(html.headers.get("link")).toContain('rel="service-desc"');
    serverHarness.entryFetch.mockResolvedValueOnce(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    const json = await server.fetch(new Request("https://openodia.com/data"), undefined, {});
    expect(json.headers.get("link")).toBeNull();
  });

  it("skips agent links when the SSR response has no content-type header at all", async () => {
    serverHarness.entryFetch.mockResolvedValueOnce(responseWithoutContentType("<html></html>"));
    const response = await server.fetch(
      new Request("https://openodia.com/no-content-type"),
      undefined,
      {},
    );
    expect(response.headers.get("link")).toBeNull();
  });

  it("skips markdown conversion when the SSR response has no content-type header at all", async () => {
    serverHarness.entryFetch.mockResolvedValueOnce(responseWithoutContentType("<html></html>"));
    const response = await server.fetch(
      new Request("https://openodia.com/no-content-type", {
        headers: { accept: "text/markdown" },
      }),
      undefined,
      {},
    );
    expect(response.headers.get("x-markdown-tokens")).toBeNull();
  });

  it("appends Accept to an existing Vary header instead of replacing it", async () => {
    serverHarness.entryFetch.mockResolvedValueOnce(
      new Response("<html><head><title>Page</title></head><body>Hi</body></html>", {
        headers: { "content-type": "text/html", vary: "Origin" },
      }),
    );
    const response = await server.fetch(
      new Request("https://openodia.com/vary", { headers: { accept: "text/markdown" } }),
      undefined,
      {},
    );
    expect(response.headers.get("vary")).toBe("Origin, Accept");
  });
});

describe("event endpoint fallbacks and paging", () => {
  it("uses live chapter data when D1 is absent and paginates", async () => {
    serverHarness.chapterEvents
      .mockResolvedValueOnce([event, event])
      .mockRejectedValueOnce(new Error("chapter offline"));
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=1&limit=1"),
      undefined,
      {},
    );
    expect(await response.json()).toMatchObject({
      events: [event],
      total: 1,
      source: "scrape",
    });
  });

  it("falls back when D1 fails and caps malformed paging values", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    serverHarness.readEvents.mockRejectedValueOnce(new Error("D1 offline"));
    serverHarness.chapterEvents.mockResolvedValue([event]);
    const db = {};
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=nope&limit=500"),
      { EVENTS_DB: db },
      {},
    );
    expect(await response.json()).toMatchObject({ total: 1, source: "scrape" });
  });

  it("uses D1 results directly and skips the live scrape when D1 returns events", async () => {
    serverHarness.readEvents.mockResolvedValueOnce([event]);
    const response = await server.fetch(
      new Request("https://openodia.com/api/events"),
      { EVENTS_DB: {} },
      {},
    );
    expect(await response.json()).toMatchObject({ source: "d1" });
    expect(serverHarness.chapterEvents).not.toHaveBeenCalled();
  });

  it("falls through to live scrape when D1 succeeds but returns no events", async () => {
    serverHarness.readEvents.mockResolvedValueOnce([]);
    serverHarness.chapterEvents.mockResolvedValue([event]);
    const response = await server.fetch(
      new Request("https://openodia.com/api/events"),
      { EVENTS_DB: {} },
      {},
    );
    expect(await response.json()).toMatchObject({ source: "scrape" });
    expect(serverHarness.readEvents).toHaveBeenCalled();
  });

  it("defaults the limit when page is present without a limit param", async () => {
    serverHarness.chapterEvents.mockResolvedValue([event, event2, event3]);
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=1"),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events).toHaveLength(3);
    expect(body.nextCursor).toBeUndefined();
  });

  it("falls back to defaults for an empty page param and a non-numeric limit", async () => {
    serverHarness.chapterEvents.mockResolvedValue([event, event2, event3]);
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=&limit=abc"),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("reports a next cursor when more pages remain", async () => {
    serverHarness.chapterEvents.mockResolvedValue([event, event2, event3]);
    const response = await server.fetch(
      new Request("https://openodia.com/api/events?page=1&limit=1"),
      undefined,
      {},
    );
    const body = await response.json();
    expect(body.nextCursor).toBe("2");
  });
});

describe("SSR failure normalization", () => {
  it("replaces swallowed catastrophic SSR JSON with the branded page", async () => {
    const captured = new Error("captured render error");
    serverHarness.capturedError.mockReturnValueOnce(captured);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    serverHarness.entryFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ unhandled: true, message: "HTTPError", status: 500 }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await server.fetch(new Request("https://openodia.com/broken"), undefined, {});
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("This page didn't load");
    expect(errorLog).toHaveBeenCalledWith(captured);
  });

  it("constructs a fallback Error when nothing was captured for a swallowed SSR error", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    serverHarness.entryFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ unhandled: true, message: "HTTPError", status: 500 }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await server.fetch(new Request("https://openodia.com/broken"), undefined, {});
    expect(response.status).toBe(500);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("h3 swallowed SSR error") }),
    );
  });

  it("passes through non-catastrophic 500 responses", async () => {
    for (const response of [
      new Response("html", { status: 500, headers: { "content-type": "text/html" } }),
      new Response("not-json", { status: 500, headers: { "content-type": "application/json" } }),
      new Response(JSON.stringify(["array"]), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({ unhandled: true, message: "Different" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({ unhandled: true, message: "HTTPError", extra: true }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
      responseWithoutContentType("plain", { status: 500 }),
    ]) {
      serverHarness.entryFetch.mockResolvedValueOnce(response);
      const result = await server.fetch(new Request("https://openodia.com/test"), undefined, {});
      expect(result.status).toBe(500);
    }
  });

  it("brands exceptions thrown outside the SSR response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    serverHarness.entryFetch.mockRejectedValueOnce(new Error("exploded"));
    const response = await server.fetch(new Request("https://openodia.com/test"), undefined, {});
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("This page didn't load");
  });
});

describe("scheduled cache and event refresh", () => {
  it("warms every catalog source and skips an absent D1 binding", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    serverHarness.repos.mockRejectedValueOnce(new Error("GitHub offline"));
    await server.scheduled({}, { CATALOG_KV: { get: vi.fn(), put: vi.fn() } }, {});
    expect(serverHarness.awesome).toHaveBeenCalled();
    expect(serverHarness.datasets).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("scheduled: EVENTS_DB not bound; skipping events sync");
  });

  it("syncs D1 and reports both success and failure", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = { EVENTS_DB: {} };
    await server.scheduled({}, env, {});
    expect(log).toHaveBeenCalledWith("events sync: 2 upserted");
    serverHarness.syncEvents.mockRejectedValueOnce(new Error("sync failed"));
    await server.scheduled({}, env, {});
    expect(error).toHaveBeenCalledWith("events sync failed", expect.any(Error));
  });
});

describe("getServerEntry default export fallback", () => {
  afterEach(() => {
    vi.doUnmock("@tanstack/react-start/server-entry");
    vi.resetModules();
  });

  it("uses the module namespace directly when it has no default export", async () => {
    vi.resetModules();
    const freshFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.doMock("@tanstack/react-start/server-entry", () => ({
      fetch: freshFetch,
      default: undefined,
    }));
    const { default: freshServer } = await import("../src/server");
    const response = await freshServer.fetch(
      new Request("https://openodia.com/about"),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    expect(freshFetch).toHaveBeenCalled();
  });
});
