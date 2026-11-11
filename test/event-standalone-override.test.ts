// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { D1Like } from "../src/lib/events-store";

const alias = "https://gdg.community.dev/events/details/standalone-old";
const canonical = "https://gdg.community.dev/events/details/standalone-current";
const proof = { evidenceUrl: "https://example.org/official", verifiedAt: "2026-10-12" };
vi.mock("../src/data/event-overrides", () => ({
  EVENT_OVERRIDES: [
    {
      url: "https://gdg.community.dev/events/details/standalone-old",
      evidenceUrl: "https://example.org/official",
      reviewedAt: "2026-10-12",
      patch: {
        lifecycle: {
          state: "cancelled",
          evidenceUrl: "https://example.org/official",
          verifiedAt: "2026-10-12",
        },
      },
    },
  ],
}));
import { readEventsFromD1, syncEventsToD1 } from "../src/lib/events-store";

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

it("carries a standalone override from a vanished alias to its live canonical event", async () => {
  expect(proof.verifiedAt).toBe("2026-10-12");
  await db
    .prepare("INSERT INTO event_destination_aliases VALUES(?,?,?)")
    .bind(alias, canonical, "2026-10-12")
    .run();
  const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: {
            results: [
              {
                url: canonical,
                title: "Current title",
                description: "d",
                event_type_title: "Workshop",
                start_date: "2099-02-01",
              },
            ],
          },
          pastEvents: { results: [] },
        },
      },
    },
  })}</script>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input, init) =>
      init?.method === "HEAD" ? new Response(null) : new Response(page),
    ),
  );
  await syncEventsToD1(db);
  const current = (await readEventsFromD1(db)).find((event) => event.url === canonical);
  expect(current).toMatchObject({ title: "Current title", lifecycle: { state: "cancelled" } });
  vi.unstubAllGlobals();
});

it("discovers a standalone override's redirect when no alias was stored yet", async () => {
  for (const table of ["event_destination_aliases", "event_reviewed_metadata", "events"])
    await db.prepare(`DELETE FROM ${table}`).run();
  const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: {
            results: [
              {
                url: canonical,
                title: "Current title",
                description: "d",
                event_type_title: "Workshop",
                start_date: "2099-02-01",
              },
            ],
          },
          pastEvents: { results: [] },
        },
      },
    },
  })}</script>`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      if (init?.method !== "HEAD") return new Response(page);
      return String(input).startsWith(alias)
        ? new Response(null, { status: 301, headers: { location: canonical } })
        : new Response(null, { status: 200 });
    }),
  );
  await syncEventsToD1(db);
  const current = (await readEventsFromD1(db)).find((event) => event.url === canonical);
  expect(current).toMatchObject({ lifecycle: { state: "cancelled" } });
  vi.unstubAllGlobals();
});
