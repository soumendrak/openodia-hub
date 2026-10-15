// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { withEventDatabase, getEventDatabase } from "../src/lib/event-request-context";
import type { D1Like } from "../src/lib/events-store";

describe("reviewed database belongs to one request", () => {
  it("isolates overlapping and nested async requests and restores the outer context", async () => {
    const first: D1Like = { prepare: vi.fn() };
    const second: D1Like = { prepare: vi.fn() };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = withEventDatabase(first, async () => {
      expect(getEventDatabase()).toBe(first);
      await gate;
      expect(getEventDatabase()).toBe(first);
      await withEventDatabase(undefined, async () => {
        await Promise.resolve();
        expect(getEventDatabase()).toBeUndefined();
      });
      expect(getEventDatabase()).toBe(first);
    });
    await withEventDatabase(second, async () => {
      expect(getEventDatabase()).toBe(second);
      release();
      await pending;
      expect(getEventDatabase()).toBe(second);
    });
    expect(getEventDatabase()).toBeUndefined();
  });
});
