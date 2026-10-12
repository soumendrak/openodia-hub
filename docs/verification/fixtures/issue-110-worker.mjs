// Local built-artifact verification only. Never binds to production services.
// Run after `bun run build`: node docs/verification/fixtures/issue-110-worker.mjs
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";
import { CHANNELS } from "../../../src/data/channels.ts";
const alias = "https://gdg.community.dev/events/details/old-fixture-slug";
const canonical = "https://gdg.community.dev/events/details/current-fixture-slug";
const port = Number(process.env.E2E_PORT ?? "9110");
const mf = new Miniflare({
  modules: true,
  scriptPath: resolve("dist/server/index.js"),
  modulesRoot: resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
  compatibilityDate: "2025-09-24",
  compatibilityFlags: ["nodejs_compat"],
  assets: {
    directory: resolve("dist/client"),
    binding: "ASSETS",
    routerConfig: { has_user_worker: true },
  },
  d1Databases: ["EVENTS_DB"],
  kvNamespaces: ["CATALOG_KV", "CONTRIBUTORS_KV"],
  // Direct outbound service preserves HTTP redirect semantics. The fetchMock
  // adapter auto-follows redirects and masks Location/Response.url behavior.
  outboundService: async (request) => {
    if (request.method === "HEAD" && request.url === alias)
      return new Response(null, { status: 302, headers: { location: canonical } });
    if (request.method === "HEAD") return new Response(null, { status: 200 });
    return new Response("upstream unavailable", { status: 503 });
  },
  port,
});
try {
  const db = await mf.getD1Database("EVENTS_DB");
  for (const file of [
    "db/schema.sql",
    "db/migrations/0002_event_reviewed_metadata.sql",
    "db/migrations/0002_event_reviewed_metadata.sql",
  ])
    for (const sql of readFileSync(file, "utf8")
      .split(";")
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
  const kv = await mf.getKVNamespace("CATALOG_KV");
  for (const key of [
    "repos",
    "awesome",
    "hf-models",
    "hf-datasets",
    "external-catalogs",
    "papers",
    "videos",
  ])
    await kv.put(
      `cache:v3:${key}`,
      JSON.stringify({
        at: Date.now(),
        value: key.startsWith("hf-")
          ? { items: [], truncated: false }
          : key === "videos"
            ? CHANNELS.map((channel) => ({ ...channel, videos: [], playlists: [] }))
            : [],
      }),
    );
  const proof = { evidenceUrl: "https://example.org/official", verifiedAt: "2026-10-12" };
  const states = [
    ["cancelled", "cancelled", "closed", undefined],
    ["postponed", "postponed", "unknown", undefined],
    ["rescheduled", "postponed", "waitlist", "2099-03-02"],
    ["scheduled", "scheduled", "open", undefined],
    ["soldout", "scheduled", "sold-out", undefined],
    ["notopen", "scheduled", "not-open", undefined],
  ];
  for (const [id, state, registration, replacementDate] of states) {
    const url = `https://example.org/${id}`;
    await db
      .prepare(
        "INSERT INTO events(id,url,title,community,type,start_date,description,location) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        url,
        url,
        `Lifecycle fixture ${id}`,
        "GDG Bhubaneswar",
        "Workshop",
        "2099-01-10",
        "Reviewed fixture — local only",
        "Bhubaneswar",
      )
      .run();
    const patch = {
      lifecycle: {
        state,
        ...proof,
        ...(replacementDate ? { replacementDate, previousDate: "2099-01-10" } : {}),
      },
      registration: {
        state: registration,
        ...proof,
        ...(registration === "open" || registration === "waitlist"
          ? { url: "https://example.org/register" }
          : {}),
      },
      attendance: { policy: "eligibility", note: "Students with ID; fee unknown" },
      notices: [
        {
          kind: state === "cancelled" ? "cancellation" : "time",
          text: `Reviewed ${id} notice ` + "LongNotice".repeat(50),
          ...proof,
        },
      ],
    };
    await db
      .prepare(
        "INSERT INTO event_reviewed_metadata(event_id,payload_json,reviewed_at) VALUES(?,?,?)",
      )
      .bind(url, JSON.stringify({ patch }), "2026-10-12T00:00:00.000Z")
      .run();
  }
  for (const [url, title, date] of [
    [alias, "Stale redirect fixture", "2099-01-10"],
    [canonical, "Canonical redirect fixture", "2099-02-01"],
  ])
    await db
      .prepare(
        "INSERT INTO events(id,url,title,community,type,start_date,description) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(url, url, title, "GDG Bhubaneswar", "Workshop", date, "Local redirect fixture")
      .run();
  await db
    .prepare("INSERT INTO event_reviewed_metadata(event_id,payload_json,reviewed_at) VALUES(?,?,?)")
    .bind(
      canonical,
      JSON.stringify({ patch: { lifecycle: { state: "cancelled", ...proof } } }),
      "2026-10-12T00:00:00.000Z",
    )
    .run();
  const apiResponse = await mf.dispatchFetch("http://localhost:9110/api/events");
  assert.equal(apiResponse.status, 200);
  const api = await apiResponse.json();
  assert.equal(api.events.filter((e) => e.url === canonical).length, 1);
  assert(!api.events.some((e) => e.url === alias));
  assert(["live", "upcoming"].includes(api.events[0].status));
  const cancelled = api.events.find((e) => e.url === "https://example.org/cancelled");
  assert.equal(cancelled.lifecycle.state, "cancelled");
  assert.equal(cancelled.status, undefined);
  assert.equal(cancelled.registration.state, "closed");
  assert.equal(api.events.find((e) => e.url === "https://example.org/postponed").status, undefined);
  assert.equal(
    api.events.find((e) => e.url === "https://example.org/rescheduled").startDate,
    "2099-03-02",
  );
  const searchResponse = await mf.dispatchFetch(
    "http://localhost:9110/api/search?q=Lifecycle%20fixture%20cancelled&kind=event",
  );
  assert.equal(searchResponse.status, 200);
  const search = await searchResponse.json();
  assert(
    search.results.some(
      (r) => r.summary.includes("Cancelled") && r.summary.includes("Registration closed"),
    ),
  );
  const rssResponse = await mf.dispatchFetch("http://localhost:9110/events-feed");
  assert.equal(rssResponse.status, 200);
  const rss = await rssResponse.text();
  assert(
    rss.includes("Cancelled") && rss.includes("Registration closed") && rss.includes("Rescheduled"),
  );
  const htmlResponse = await mf.dispatchFetch("http://localhost:9110/events");
  assert.equal(htmlResponse.status, 200);
  const html = await htmlResponse.text();
  assert(/Cancelled\s+or postponed/.test(html));
  assert(html.includes("EventCancelled") && html.includes("EventRescheduled"));
  assert(html.includes("2099-03-02"));
  assert(!html.includes(alias));
  assert(html.includes("Registration page"));
  const aliasSearch = await (
    await mf.dispatchFetch("http://localhost:9110/api/search?q=redirect%20fixture&kind=event")
  ).json();
  assert(!aliasSearch.results.some((e) => e.externalHref === alias));
  assert(
    aliasSearch.results.some(
      (e) => e.externalHref === canonical && e.summary.includes("Cancelled"),
    ),
  );
  assert(!rss.includes(alias));
  mkdirSync("/tmp/openodia-110-verified", { recursive: true });
  writeFileSync(
    "/tmp/openodia-110-verified/worker-fixture.json",
    JSON.stringify(
      {
        apiStatus: apiResponse.status,
        api,
        searchStatus: searchResponse.status,
        search,
        rssStatus: rssResponse.status,
        htmlStatus: htmlResponse.status,
      },
      null,
      2,
    ),
  );
  writeFileSync("/tmp/openodia-110-verified/worker-events.html", html);
  console.log("PASS built Worker API/search/RSS/SSR + repeatable local migration");
  if (process.argv.includes("--serve")) {
    console.log(`Browser fixture listening at ${await mf.ready}`);
    await new Promise((resolve) => {
      process.once("SIGTERM", resolve);
      process.once("SIGINT", resolve);
    });
  }
  await db.prepare("DROP TABLE events").run();
  const fallback = await mf.dispatchFetch("http://localhost:9110/api/events?page=1&limit=1");
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("Cache-Control"), "no-store");
  assert.equal((await fallback.json()).partial, true);
  console.log(
    "PASS built Worker broken-D1 fallback + redirect aliases + active-first page + registration destination",
  );
} finally {
  await mf.dispose();
}
