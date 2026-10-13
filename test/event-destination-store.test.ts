// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readEventDestinationAliases,
  refreshEventDestinationAliases,
  storedEventDestination,
} from "../src/lib/event-destination-store";
import { eventUrlKey } from "../src/lib/event-url";
import type { D1Like } from "../src/lib/events-store";
let mf: Miniflare;
let db: D1Like;
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch:()=>new Response('')}",
    d1Databases: ["EVENTS_DB"],
  });
  db = await mf.getD1Database("EVENTS_DB");
  for (const sql of readFileSync("db/schema.sql", "utf8")
    .split(";")
    .filter((sql) => sql.trim()))
    await db.prepare(sql).run();
});
afterAll(() => mf.dispose());
afterEach(async () => {
  await db.prepare("DELETE FROM event_destination_aliases").run();
  vi.restoreAllMocks();
});

describe("persisted event destinations", () => {
  it("spends at most 30 HEAD requests across hops, limits concurrency and rotates unseen URLs", async () => {
    const urls = Array.from({ length: 12 }, (_, i) => ({
      url: `https://gdg.community.dev/events/details/budget-${String(i).padStart(2, "0")}`,
    }));
    let active = 0;
    let maximum = 0;
    const origins: string[] = [];
    const fetcher = vi.fn(async (input) => {
      active++;
      maximum = Math.max(maximum, active);
      const url = new URL(String(input));
      if (!url.pathname.includes("-hop-")) origins.push(url.href);
      await Promise.resolve();
      active--;
      const match = url.pathname.match(/-hop-(\d+)$/);
      const base = url.pathname.replace(/-hop-\d+$/, "");
      return new Response(null, {
        status: 302,
        headers: { location: `${base}-hop-${Number(match?.[1] ?? 0) + 1}` },
      });
    });
    const first = await refreshEventDestinationAliases(db, urls, fetcher as typeof fetch);
    expect(first.requests).toBe(30);
    expect(first.checked).toBe(6);
    expect(fetcher).toHaveBeenCalledTimes(30);
    expect(maximum).toBeLessThanOrEqual(3);
    expect(origins).toEqual(urls.slice(0, 6).map((event) => event.url));
    origins.length = 0;
    const second = await refreshEventDestinationAliases(db, urls, fetcher as typeof fetch);
    expect(second.requests).toBe(30);
    expect(origins).toEqual(urls.slice(6).map((event) => event.url));
    const rows = await db
      .prepare("SELECT alias_url, destination_url FROM event_destination_aliases")
      .all<{ alias_url: string; destination_url: null }>();
    expect(rows.results).toHaveLength(12);
    expect(rows.results.every((row) => row.destination_url === null)).toBe(true);
  });

  it("retains a confirmed destination through later failures and refreshes oldest observations first", async () => {
    const alias = "https://gdg.community.dev/events/details/old-name";
    const canonical = "https://gdg.community.dev/events/details/new-name/";
    const resolver = vi.fn(
      async (input) =>
        new Response(
          null,
          String(input) === alias
            ? { status: 302, headers: { location: canonical } }
            : { status: 200 },
        ),
    );
    await refreshEventDestinationAliases(db, [{ url: alias }], resolver as typeof fetch);
    expect((await readEventDestinationAliases(db)).get(eventUrlKey(alias))).toBe(canonical);
    await refreshEventDestinationAliases(
      db,
      [{ url: alias }],
      vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch,
    );
    expect((await readEventDestinationAliases(db)).get(eventUrlKey(alias))).toBe(canonical);
    await db
      .prepare(
        "UPDATE event_destination_aliases SET checked_at = 'not-a-timestamp' WHERE alias_url = ?",
      )
      .bind(eventUrlKey(alias))
      .run();
    const fresh = "https://gdg.community.dev/events/details/fresh-name";
    await refreshEventDestinationAliases(
      db,
      [{ url: fresh }],
      vi.fn(async () => new Response(null)) as typeof fetch,
    );
    const ordered: string[] = [];
    await refreshEventDestinationAliases(
      db,
      [{ url: fresh }, { url: alias }],
      vi.fn(async (input) => {
        ordered.push(String(input));
        return new Response(null);
      }) as typeof fetch,
    );
    expect(ordered[0]).toBe(alias);
  });

  it("follows recorded chains without networking, rejects cycles and ignores unsafe persisted destinations", async () => {
    const a = "https://gdg.community.dev/events/details/a";
    const b = "https://gdg.community.dev/events/details/b";
    const c = "https://gdg.community.dev/events/details/c";
    expect(
      storedEventDestination(
        a,
        new Map([
          [a, b],
          [b, c],
        ]),
      ),
    ).toBe(c);
    expect(
      storedEventDestination(
        a,
        new Map([
          [a, b],
          [b, a],
        ]),
      ),
    ).toBe(a);
    expect(storedEventDestination(a, new Map([[a, a]]))).toBe(a);
    await db
      .prepare("INSERT INTO event_destination_aliases VALUES(?, ?, ?)")
      .bind(a, "https://outside.example/event", "2026-10-13")
      .run();
    expect(await readEventDestinationAliases(db)).toEqual(new Map());
    const empty = await refreshEventDestinationAliases(
      db,
      [{ url: "https://outside.example/event" }],
      vi.fn(),
    );
    expect(empty).toMatchObject({ checked: 0, requests: 0 });
  });
});
