/** Production Worker with recorded cache entries and denied external networking. */
import { Miniflare, createFetchMock } from "miniflare";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const outage = process.env.E2E_UPSTREAM_FAILURE === "1";
const port = Number(process.env.E2E_PORT ?? 9161);
const mock = createFetchMock();
mock.disableNetConnect();
if (!outage) {
  mock
    .get("https://pypi.org")
    .intercept({ path: "/pypi/openodia/json" })
    .reply(200, {
      info: { version: "0.2.0", summary: "Odia language tools" },
      releases: { "0.1.0": [], "0.2.0": [] },
    })
    .persist();
  mock
    .get("https://api.github.com")
    .intercept({ path: "/repos/soumendrak/MTEnglish2Odia" })
    .reply(200, {
      name: "MTEnglish2Odia",
      full_name: "soumendrak/MTEnglish2Odia",
      description: "Machine Translation from English to Odia language.",
      language: "Jupyter Notebook",
      stargazers_count: 10,
      topics: ["machine-translation", "odia", "parallel-corpus"],
      license: { spdx_id: "GPL-3.0" },
      created_at: "2018-12-03T14:32:20Z",
      updated_at: "2024-11-12T11:45:31Z",
    })
    .persist();
  const event = {
    title: "Recorded Odia AI workshop",
    start_date: "2030-10-12T10:00:00Z",
    url: "https://gdg.community.dev/events/details/recorded-odia-workshop/",
    event_type_title: "Workshop",
    description_short: "Recorded upstream fixture for browser tests",
    description: "Recorded upstream fixture",
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: { upcomingEvents: { results: [event] }, pastEvents: { results: [] } } } } })}</script>`;
  mock
    .get("https://gdg.community.dev")
    .intercept({ path: /.*/, method: "GET" })
    .reply(200, html, { headers: { "content-type": "text/html" } })
    .persist();
}
// Uncached upstreams have explicit deterministic failure responses, never live network.
mock
  .get(/.*/)
  .intercept({ path: /.*/, method: "GET" })
  .reply(503, JSON.stringify({ error: "fixture_upstream_unavailable" }), {
    headers: { "content-type": "application/json" },
  })
  .persist();
// Freeze the Worker JavaScript clock before evaluating production imports.
const fixtureNow = Date.parse("2026-10-12T00:00:00Z");
const clockName = `e2e-clock-${port}.mjs`;
const entryPath = resolve(`dist/server/e2e-entry-${port}.mjs`);
writeFileSync(
  resolve("dist/server", clockName),
  `
const NativeDate = globalThis.Date;
function FixtureDate(...args) {
  if (!new.target) return new NativeDate(${fixtureNow}).toString();
  return new NativeDate(...(args.length ? args : [${fixtureNow}]));
}
Object.setPrototypeOf(FixtureDate, NativeDate);
FixtureDate.prototype = NativeDate.prototype;
FixtureDate.now = () => ${fixtureNow};
globalThis.Date = FixtureDate;
`,
);
writeFileSync(
  entryPath,
  `import "./${clockName}"; import production from "./index.js"; export default { ...production, fetch(request, env, ctx) { if (new URL(request.url).pathname === "/__fixture-clock") return Response.json({ now: Date.now(), iso: new Date().toISOString() }); return production.fetch(request, env, ctx); } };`,
);
const worker = new Miniflare({
  port,
  host: "127.0.0.1",
  modules: true,
  scriptPath: entryPath,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
  compatibilityDate: "2025-09-24",
  compatibilityFlags: ["nodejs_compat"],
  assets: { directory: resolve("dist/client"), routerConfig: { has_user_worker: true } },
  kvNamespaces: ["CATALOG_KV", "CONTRIBUTORS_KV"],
  d1Databases: ["EVENTS_DB"],
  fetchMock: mock,
});
if (!outage) {
  const db = await worker.getD1Database("EVENTS_DB");
  await db.exec(
    readFileSync("db/schema.sql", "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("--"))
      .join(" "),
  );
  const kv = await worker.getKVNamespace("CATALOG_KV");
  const entries = readFileSync(new URL("fixtures/catalog-kv.jsonl", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  for (const { key, value } of entries)
    await kv.put(`cache:v3:${key}`, JSON.stringify({ at: fixtureNow, value }));
}
await worker.ready;
console.log(
  `Fixture Worker ready http://127.0.0.1:${port} (${outage ? "upstream outage" : "recorded catalog"})`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await worker.dispose();
    process.exit(0);
  });
