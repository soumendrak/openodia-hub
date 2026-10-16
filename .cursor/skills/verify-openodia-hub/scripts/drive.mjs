import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const port = process.env.VERIFY_PORT ?? "9171";
const runDir = process.env.VERIFY_DIR ?? "/tmp/verify-openodia-hub";
const out = process.env.VERIFY_EVIDENCE ?? `${runDir}/evidence`;
const origin = `http://127.0.0.1:${port}`;
const [path = "/", ...steps] = process.argv.slice(2);
const run = Date.now();
const allowStatus = new Set(
  (process.env.VERIFY_ALLOW_STATUS ?? "")
    .split(",")
    .map((v) => v.trim().split(/\s+/).join(" "))
    .filter((v) => /^\d{3} [A-Z]+ \/\S*$/.test(v)),
);
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error(`node 22+ required, this is ${process.version}: run with "$VERIFY_NODE"`);
  process.exit(1);
}
const split = (s, sep) => {
  const i = s.indexOf(sep);
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const log = [];
const navigations = [];
let failed = null;
const saves = [];
let saved = 0;
const saveResponse = async (r) => {
  saved += 1;
  const u = new URL(r.url());
  const base = `${out}/${run}-api-${String(saved).padStart(2, "0")}-${u.pathname.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "root"}`;
  const meta = {
    url: u.pathname + u.search,
    method: r.request().method(),
    status: r.status(),
    headers: await r.allHeaders(),
    requestBody: r.request().postData(),
  };
  const body = await r.body();
  await writeFile(`${base}.json`, JSON.stringify(meta, null, 2));
  await writeFile(`${base}.body`, body);
  log.push(`saved ${meta.method} ${meta.url} -> ${base}.body`);
};
let page;
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  page.on("pageerror", (e) => log.push(`pageerror ${e.message}`));
  page.on("console", (m) => {
    if (
      ["error", "warning"].includes(m.type()) &&
      /hydrat|react error|server rendered|did not match/i.test(m.text())
    )
      log.push(`hydration ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame())
      navigations.push({ path: new URL(r.url()).pathname, status: r.status() });
    if (new URL(r.url()).origin === origin)
      log.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    const kind = r.request().resourceType();
    if (new URL(r.url()).origin === origin && (kind === "fetch" || kind === "xhr")) {
      saves.push(saveResponse(r));
      if (
        r.status() >= 400 &&
        !allowStatus.has(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`)
      )
        log.push(`httperror ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
  const visit = async (p) => {
    const res = await page.goto(origin + p);
    if (!res) navigations.push({ path: p, status: null });
    await page.waitForLoadState("networkidle");
    await page
      .waitForFunction(
        () => {
          const button = document.querySelector("header button");
          return (
            button !== null &&
            Object.keys(button).some(
              (key) => key.startsWith("__reactProps") && typeof button[key]?.onClick === "function",
            )
          );
        },
        null,
        { timeout: 15000 },
      )
      .catch(() =>
        log.push(`hydration timeout: no React onClick on header button after visiting ${p}`),
      );
  };
  let n = 0;
  const shot = async (label) => {
    n += 1;
    const f = `${out}/${run}-${String(n).padStart(2, "0")}-${label}.png`;
    await page.screenshot({ path: f, fullPage: false });
    log.push(`screenshot ${f}`);
  };
  await visit(path);
  await shot("loaded");
  for (const step of steps) {
    const [verb, arg] = split(step, ":");
    try {
      if (verb === "fill") {
        const [ph, value] = split(arg, "=");
        await page.getByPlaceholder(ph).fill(value);
      } else if (verb === "click") await page.getByRole("button", { name: arg }).click();
      else if (verb === "link") await page.getByRole("link", { name: arg }).first().click();
      else if (verb === "press") await page.keyboard.press(arg);
      else if (verb === "expect")
        await page.getByText(arg).first().waitFor({ state: "visible", timeout: 15000 });
      else if (verb === "goto") await visit(arg);
      else if (verb === "attr") {
        const [sel, name, want] = arg.split("|");
        const got = await page.locator(sel).first().getAttribute(name, { timeout: 15000 });
        if (got !== want) throw new Error(`${sel} ${name}="${got}", want "${want}"`);
      } else if (verb === "h1") {
        const h = ((await page.locator("h1").first().textContent({ timeout: 15000 })) ?? "").trim();
        if (!h.startsWith(arg)) throw new Error(`h1 "${h}" does not start with "${arg}"`);
      } else throw new Error(`unknown step ${step}`);
      await page.waitForLoadState("networkidle");
      log.push(`step ok ${step}`);
      await shot(verb);
    } catch (e) {
      failed = { step, error: String(e?.message ?? e) };
      log.push(`step failed ${step}`);
      await shot("failed").catch(() => {});
      break;
    }
  }
} catch (e) {
  failed = failed ?? { step: "launch", error: String(e?.message ?? e) };
} finally {
  const settled = await Promise.allSettled(saves);
  for (const r of settled)
    if (r.status === "rejected") log.push(`evidenceerror ${String(r.reason?.message ?? r.reason)}`);
  const last = navigations.at(-1);
  const bad =
    failed !== null ||
    log.some(
      (l) =>
        l.startsWith("pageerror") ||
        l.startsWith("hydration") ||
        l.startsWith("httperror") ||
        l.startsWith("evidenceerror"),
    ) ||
    navigations.some((v) => v.status === null || v.status >= 400);
  const summary = {
    ok: !bad,
    url: page?.url() ?? null,
    status: last?.status ?? null,
    navigations,
    h1: page
      ? await page
          .locator("h1")
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => null)
      : null,
    steps,
    failed,
    log,
  };
  await writeFile(`${out}/${run}-drive.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  process.exitCode = bad ? 1 : 0;
}
