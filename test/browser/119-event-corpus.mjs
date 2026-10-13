/** Reproduce PR119 paging and partial-corpus behavior against the built Worker. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Miniflare, createFetchMock } from "miniflare";
import { chromium } from "playwright";

const port = Number(process.env.PR119_PORT || 9221);
const origin = `http://127.0.0.1:${port}`;
const output = resolve(process.env.PR119_OUTPUT || ".lavish/pr119-followup/browser");
await mkdir(output, { recursive: true });
const now = Date.parse("2026-10-12T00:00:00Z");
const artifact = await readFile("dist/server/index.js");
const entry = resolve(`dist/server/pr119-entry-${port}.mjs`);
const clock = `pr119-clock-${port}.mjs`;
await writeFile(
  resolve("dist/server", clock),
  `const NativeDate = globalThis.Date;
function FixtureDate(...args) {
  if (!new.target) return new NativeDate(${now}).toString();
  return new NativeDate(...(args.length ? args : [${now}]));
}
Object.setPrototypeOf(FixtureDate, NativeDate);
FixtureDate.prototype = NativeDate.prototype;
FixtureDate.now = () => ${now};
globalThis.Date = FixtureDate;
`,
);
await writeFile(entry, `import "./${clock}"; export { default } from "./index.js";\n`);
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const mock = createFetchMock();
mock.disableNetConnect();
for (const method of ["GET", "HEAD"])
  mock.get(/.*/).intercept({ path: /.*/, method }).reply(503, "fixture denied upstream").persist();
const worker = new Miniflare({
  host: "127.0.0.1",
  port,
  modules: true,
  scriptPath: entry,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  assets: { directory: resolve("dist/client"), routerConfig: { has_user_worker: true } },
  kvNamespaces: ["CATALOG_KV", "CONTRIBUTORS_KV"],
  d1Databases: ["EVENTS_DB"],
  fetchMock: mock,
});
const checks = [];
let browser;
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, pass: true });
  } catch (error) {
    checks.push({ name, pass: false, error: error.message });
  }
}
try {
  const db = await worker.getD1Database("EVENTS_DB");
  await db.exec(
    (await readFile("db/schema.sql", "utf8"))
      .split("\n")
      .filter((line) => !line.startsWith("--"))
      .join(" "),
  );
  const url = "https://example.org/newly-discovered-future-event";
  const title = "Newly discovered future corpus event";
  await db
    .prepare(
      "INSERT INTO events(id,url,title,community,type,start_date,end_date,description) VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(
      url,
      url,
      title,
      "GDG Bhubaneswar",
      "Workshop",
      "2099-01-01",
      "2099-01-01",
      "Synthetic paging fixture",
    )
    .run();
  const sourceText = await readFile("src/routes/api/events.ts", "utf8");
  const slugs = [...sourceText.matchAll(/slug: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(slugs.length, 5);
  for (const [index, slug] of slugs.entries())
    await db
      .prepare(
        "INSERT INTO event_source_status(source_id,outcome,event_count,last_attempt_at,last_success_at,upcoming_complete,past_complete) VALUES(?,?,?,?,?,1,1)",
      )
      .bind(
        slug,
        index ? "success-empty" : "success-events",
        index ? 0 : 1,
        new Date(now).toISOString(),
        new Date(now).toISOString(),
      )
      .run();
  await worker.ready;
  await check("built Worker first page starts with a novel future event", async () => {
    const response = await fetch(`${origin}/api/events?page=1&limit=1`);
    const body = await response.json();
    await writeFile(`${output}/first-page.json`, `${JSON.stringify(body, null, 2)}\n`);
    assert.equal(response.status, 200);
    assert.equal(body.partial, false);
    assert.equal(body.events[0].url, url);
  });
  await check("built Worker full corpus has the same canonical ordering", async () => {
    const response = await fetch(`${origin}/api/events`);
    const body = await response.json();
    assert.equal(body.partial, false);
    assert.ok(body.events.length > 20);
    assert.equal(body.events[0].url, url);
  });
  browser = await chromium.launch();
  for (const width of [1280, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 812 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydrat|server rendered|did not match/i.test(message.text())
      )
        errors.push(message.text());
    });
    await page.clock.setFixedTime(new Date(now));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    await page.goto(`${origin}/events`);
    await page.waitForLoadState("networkidle");
    await check(`${width}px idle first page exposes the novel future event`, async () => {
      await page.getByRole("heading", { name: title, exact: true, level: 3 }).waitFor({
        state: "visible",
        timeout: 2000,
      });
    });
    let failedFullRequests = 0;
    await page.route("**/api/events*", (route) => {
      if (new URL(route.request().url()).searchParams.has("page")) return route.continue();
      failedFullRequests += 1;
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"events":[]}' });
    });
    await page.goto(`${origin}/events?year=2026&sort=oldest`);
    for (let attempt = 0; attempt < 100 && failedFullRequests < 2; attempt += 1) await delay(50);
    assert.equal(
      failedFullRequests,
      2,
      "full corpus retries once while the paginated source succeeds",
    );
    const warning = page.getByText(/Known events remain listed/);
    await check(
      `${width}px failed full corpus warns and retains known archive events`,
      async () => {
        await warning.waitFor({ state: "visible", timeout: 2000 });
        assert.ok(await page.locator('a[href*="events/details/"]').count());
      },
    );
    await page.screenshot({ path: `${output}/failed-full-corpus-${width}.png`, fullPage: true });
    await page.getByLabel("Event sort").selectOption("newest");
    await page.getByLabel("Archive year").selectOption("");
    await check(`${width}px clearing the filters ignores the disabled query error`, async () => {
      await page.waitForURL(
        (current) => !current.searchParams.has("year") && !current.searchParams.has("sort"),
      );
      await warning.waitFor({ state: "hidden", timeout: 2000 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
    });
    await context.close();
  }
} finally {
  await browser?.close();
  await worker.dispose();
  const report = { artifactSHA256: createHash("sha256").update(artifact).digest("hex"), checks };
  await writeFile(`${output}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
}
const failed = checks.filter((item) => !item.pass);
console.log(
  `${checks.length - failed.length}/${checks.length} built Worker/API/browser checks passed`,
);
for (const item of failed) console.error(`${item.name}: ${item.error}`);
if (failed.length) process.exitCode = 1;
