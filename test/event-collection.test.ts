import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ read: vi.fn(), statuses: vi.fn(), live: vi.fn() }));
vi.mock("../src/lib/events-store", () => ({
  readEventsFromD1: harness.read,
  readEventSourceStatuses: harness.statuses,
}));
vi.mock("../src/routes/api/events", () => ({
  CHAPTERS: [{ slug: "one" }],
  fetchLiveEventCollection: harness.live,
}));
import { loadEventCollection, setEventDatabase } from "../src/lib/event-collection";
import { events as curated } from "../src/data/events";
const known = {
  ...curated[0],
  title: "Known persisted event",
  url: "https://example.org/persisted",
};
const healthy = {
  sourceId: "one",
  outcome: "success-events",
  eventCount: 1,
  lastAttemptAt: "2026-10-12T12:00:00Z",
  lastSuccessAt: "2026-10-12T12:00:00Z",
  upcomingComplete: true,
  pastComplete: true,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T13:00:00Z"));
  harness.read.mockResolvedValue([known]);
  harness.statuses.mockResolvedValue([healthy]);
  harness.live.mockResolvedValue({
    events: [],
    sources: [{ ...healthy, outcome: "failed", errorCategory: "http" }],
    partial: true,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  setEventDatabase(undefined);
});
describe("canonical retained event collection", () => {
  it("merges checked-in and persisted history without fetching unavailable live sources", async () => {
    const result = await loadEventCollection({ prepare: vi.fn() });
    expect(result.source).toBe("d1");
    expect(result.partial).toBe(false);
    expect(result.events.some((event) => event.title === "Known persisted event")).toBe(true);
    expect(result.events.some((event) => event.url === curated[0].url)).toBe(true);
    expect(harness.live).not.toHaveBeenCalled();
  });
  it.each([
    [[], true],
    [[{ ...healthy, outcome: "failed" }], true],
    [[{ ...healthy, pastComplete: false }], true],
    [[{ ...healthy, upcomingComplete: false }], true],
    [[{ ...healthy, lastAttemptAt: "2026-10-11T00:00:00Z" }], true],
    [[{ ...healthy, lastAttemptAt: "invalid" }], true],
  ])("reports unavailable, incomplete and stale measured metadata", async (statuses, partial) => {
    harness.statuses.mockResolvedValue(statuses);
    expect((await loadEventCollection({ prepare: vi.fn() })).partial).toBe(partial);
  });
  it("keeps legacy persisted events when status tables are not deployed", async () => {
    harness.statuses.mockRejectedValue(new Error("table missing"));
    const result = await loadEventCollection({ prepare: vi.fn() });
    expect(result.partial).toBe(true);
    expect(result.sources).toEqual([]);
    expect(result.events).toContainEqual(known);
  });
  it.each(["empty", "unavailable"])(
    "preserves curated history when D1 is %s and every live source fails",
    async (mode) => {
      if (mode === "empty") harness.read.mockResolvedValue([]);
      else harness.read.mockRejectedValue(new Error("DB unavailable"));
      const result = await loadEventCollection({ prepare: vi.fn() });
      expect(result.source).toBe("scrape");
      expect(result.partial).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.sources[0].outcome).toBe("failed");
    },
  );
  it("uses the current Worker binding for search and RSS default loaders", async () => {
    setEventDatabase({ prepare: vi.fn() });
    const { loadLiveSearchEvents } = await import("../src/lib/sources/search");
    const result = await loadLiveSearchEvents();
    expect(result).toMatchObject({ source: "d1", partial: false });
    expect(harness.read).toHaveBeenCalled();
  });
  it("has no fabricated success timestamp when persistence is absent", async () => {
    const result = await loadEventCollection();
    expect(result.partial).toBe(true);
    expect(result.source).toBe("scrape");
  });
});
