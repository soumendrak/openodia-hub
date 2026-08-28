import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fresh module per test: the memo and the in-flight map are module state.
async function freshCache() {
  vi.resetModules();
  return import("../src/lib/sources/cache");
}

const TTL = 1000;

describe("cachedJson", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("serves the memo without re-running the loader inside the TTL", async () => {
    const { cachedJson } = await freshCache();
    const load = vi.fn(async () => "v1");

    expect(await cachedJson("k", TTL, load)).toBe("v1");
    vi.advanceTimersByTime(TTL - 1);
    expect(await cachedJson("k", TTL, load)).toBe("v1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value immediately and refreshes behind it", async () => {
    const { cachedJson, lastCacheLayer } = await freshCache();
    let n = 0;
    const load = vi.fn(async () => `v${++n}`);

    expect(await cachedJson("k", TTL, load)).toBe("v1");
    vi.advanceTimersByTime(TTL + 1);

    // Past the TTL the caller still gets v1 — it does not wait on the refetch.
    expect(await cachedJson("k", TTL, load)).toBe("v1");
    expect(lastCacheLayer()).toBe("STALE");

    await vi.runAllTimersAsync();
    expect(await cachedJson("k", TTL, load)).toBe("v2");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("single-flights a cold key so a burst triggers one fan-out", async () => {
    const { cachedJson } = await freshCache();
    const load = vi.fn(() => new Promise<string>((resolve) => setTimeout(() => resolve("v1"), 50)));

    const all = Promise.all([
      cachedJson("k", TTL, load),
      cachedJson("k", TTL, load),
      cachedJson("k", TTL, load),
    ]);
    await vi.runAllTimersAsync();

    expect(await all).toEqual(["v1", "v1", "v1"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a throwing loader", async () => {
    const { cachedJson } = await freshCache();
    const load = vi.fn(async () => {
      throw new Error("upstream down");
    });

    await expect(cachedJson("k", TTL, load)).rejects.toThrow("upstream down");
    await expect(cachedJson("k", TTL, load)).rejects.toThrow("upstream down");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("waits for fresh data once the value is past the stale window", async () => {
    const { cachedJson, lastCacheLayer } = await freshCache();
    let n = 0;
    const load = vi.fn(async () => `v${++n}`);

    expect(await cachedJson("k", TTL, load)).toBe("v1");
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(await cachedJson("k", TTL, load)).toBe("v2");
    expect(lastCacheLayer()).toBe("MISS");
  });

  /**
   * The layer that matters. `caches.default` was per-colo, so it never served a
   * cold isolate outside the one colo that wrote it — in production ~85% of
   * requests reported MISS and re-ran the whole upstream fan-out. A store that
   * is not consulted on a cold memo is the bug, so that is what is asserted.
   */
  describe("the global store", () => {
    /** Minimal stand-in for the KV binding. */
    function fakeKv() {
      const data = new Map<string, string>();
      return {
        data,
        get: vi.fn(async (k: string) => data.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => void data.set(k, v)),
      };
    }

    it("serves a cold isolate from the store instead of re-running the loader", async () => {
      const kv = fakeKv();

      const first = await freshCache();
      first.setCacheStore(kv);
      const load = vi.fn(async () => "v1");
      expect(await first.cachedJson("k", TTL, load)).toBe("v1");
      expect(load).toHaveBeenCalledTimes(1);
      expect(kv.put).toHaveBeenCalledTimes(1);

      // A new isolate: empty memo, same replicated store.
      const second = await freshCache();
      second.setCacheStore(kv);
      const coldLoad = vi.fn(async () => "v2");
      expect(await second.cachedJson("k", TTL, coldLoad)).toBe("v1");
      expect(coldLoad).not.toHaveBeenCalled();
      expect(second.lastCacheLayer()).toBe("KV");
    });

    it("still writes through the store on a refresh so other colos see it", async () => {
      const kv = fakeKv();
      const mod = await freshCache();
      mod.setCacheStore(kv);

      await mod.cachedJson("k", TTL, async () => "v1");
      vi.advanceTimersByTime(TTL + 1);
      await mod.cachedJson("k", TTL, async () => "v2"); // stale -> refresh behind
      await vi.waitFor(() => expect(kv.put).toHaveBeenCalledTimes(2));

      const cold = await freshCache();
      cold.setCacheStore(kv);
      expect(await cold.cachedJson("k", TTL, async () => "unused")).toBe("v2");
    });

    it("degrades to memo-only when the namespace is not bound", async () => {
      const mod = await freshCache();
      mod.setCacheStore(undefined); // binding absent

      const load = vi.fn(async () => "v1");
      expect(await mod.cachedJson("k", TTL, load)).toBe("v1");
      expect(await mod.cachedJson("k", TTL, load)).toBe("v1");
      expect(load).toHaveBeenCalledTimes(1);
      expect(mod.lastCacheLayer()).toBe("MEMO");
    });

    it("survives a store that throws rather than failing the request", async () => {
      const mod = await freshCache();
      mod.setCacheStore({
        get: async () => {
          throw new Error("kv down");
        },
        put: async () => {
          throw new Error("kv down");
        },
      });
      expect(await mod.cachedJson("k", TTL, async () => "v1")).toBe("v1");
    });
  });
});
