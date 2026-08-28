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
});
