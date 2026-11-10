import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

type ApiRoute = {
  options: { server: { handlers: { GET: () => Response | Promise<Response> } } };
};

function getHandler(route: unknown) {
  return (route as ApiRoute).options.server.handlers.GET;
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("translation status source-cache metadata", () => {
  it.each(["MEMO", "KV", "STALE"] as const)(
    "does not inherit %s from a preceding catalog request",
    async (layer) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
      const upstream = vi.fn(async () =>
        Response.json([{ id: "openodia/model", tags: ["language:or"] }]),
      );
      vi.stubGlobal("fetch", upstream);
      const kvData = new Map<string, string>();
      const kv = {
        get: async (key: string) => kvData.get(key) ?? null,
        put: async (key: string, value: string) => void kvData.set(key, value),
      };
      const initialCache = await import("../src/lib/sources/cache");
      initialCache.setCacheStore(kv);
      const coldModels = await import("../src/routes/api/models");
      const coldResponse = await getHandler(coldModels.Route)();
      expect(coldResponse.headers.get("X-Cache")).toBe("MISS");

      if (layer === "KV") {
        // A fresh isolate retains the catalog value in KV but has no memo.
        vi.resetModules();
        const coldCache = await import("../src/lib/sources/cache");
        coldCache.setCacheStore(kv);
      } else if (layer === "STALE") {
        vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      }

      const models = await import("../src/routes/api/models");
      const catalogResponse = await getHandler(models.Route)();
      expect(catalogResponse.headers.get("X-Cache")).toBe(layer);
      expect(await catalogResponse.json()).toMatchObject({
        models: [{ id: "openodia/model" }],
        truncated: false,
      });
      expect(upstream).toHaveBeenCalledTimes(layer === "STALE" ? 2 : 1);

      const status = await import("../src/routes/api/translation-status");
      const { getLocaleStatus } = await import("../src/lib/locale-status");
      const response = await getHandler(status.Route)();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, User-Agent");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=300, stale-while-revalidate=86400",
      );
      expect(response.headers.get("X-Cache")).toBeNull();
      expect(await response.json()).toEqual(getLocaleStatus());
    },
  );
});

describe("API source-cache reporting options", () => {
  it("omits source metadata independently of the HTTP cache policy and response contract", async () => {
    const { cachedJson, lastCacheLayer } = await import("../src/lib/sources/cache");
    await cachedJson("utility-test", 1000, async () => "cached");
    await cachedJson("utility-test", 1000, async () => "unused");
    const { apiJson } = await import("../src/lib/api-response");

    const staticResponse = apiJson({ ok: true }, 202, 60, { reportSourceCache: false });
    expect(staticResponse.status).toBe(202);
    expect(await staticResponse.json()).toEqual({ ok: true });
    expect(staticResponse.headers.get("Content-Type")).toBe("application/json");
    expect(staticResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(staticResponse.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=86400",
    );
    expect(staticResponse.headers.get("X-Cache")).toBeNull();
    expect(lastCacheLayer()).toBe("MEMO");

    for (const options of [undefined, {}, { reportSourceCache: true }]) {
      const sourceResponse = apiJson({ ok: true }, 200, 60, options);
      expect(sourceResponse.headers.get("X-Cache")).toBe("MEMO");
      expect(sourceResponse.headers.get("Cache-Control")).toBe(
        staticResponse.headers.get("Cache-Control"),
      );
    }
    for (const maxAge of [undefined, 0]) {
      const response = apiJson({ ok: true }, 200, maxAge, { reportSourceCache: true });
      expect(response.headers.get("Cache-Control")).toBeNull();
      expect(response.headers.get("X-Cache")).toBeNull();
    }
  });
});
