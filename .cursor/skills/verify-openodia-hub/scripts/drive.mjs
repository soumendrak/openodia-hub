import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const port = process.env.VERIFY_PORT ?? "9171";
const runDir = process.env.VERIFY_DIR ?? "/tmp/verify-openodia-hub";
const out = process.env.VERIFY_EVIDENCE ?? `${runDir}/evidence`;
const origin = `http://127.0.0.1:${port}`;
const [path = "/", ...steps] = process.argv.slice(2);
const run = Date.now();
const split = (s, sep) => {
  const i = s.indexOf(sep);
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const log = [];
const navigations = [];
let failed = null;
let page;
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  page.on("pageerror", (e) => log.push(`pageerror ${e.message}`));
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame())
      navigations.push({ path: new URL(r.url()).pathname, status: r.status() });
    if (new URL(r.url()).origin === origin)
      log.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
  const visit = async (p) => {
    const res = await page.goto(origin + p);
    if (!res) navigations.push({ path: p, status: null });
    await page.waitForLoadState("networkidle");
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
      else throw new Error(`unknown step ${step}`);
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
  const last = navigations.at(-1);
  const summary = {
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
  const bad =
    failed !== null ||
    log.some((l) => l.startsWith("pageerror")) ||
    navigations.some((v) => v.status === null || v.status >= 400);
  process.exitCode = bad ? 1 : 0;
}
