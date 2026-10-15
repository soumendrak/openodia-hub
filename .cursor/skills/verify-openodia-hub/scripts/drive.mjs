import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const port = process.env.VERIFY_PORT ?? "9171";
const out = process.env.VERIFY_EVIDENCE ?? "/tmp/verify-openodia-hub/evidence";
const origin = `http://127.0.0.1:${port}`;
const [path = "/", ...steps] = process.argv.slice(2);
const run = Date.now();
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
await page.route(
  (url) => url.origin !== origin,
  (route) => route.abort(),
);
const log = [];
page.on("pageerror", (e) => log.push(`pageerror ${e.message}`));
page.on("response", (r) => {
  if (new URL(r.url()).origin === origin)
    log.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
});
await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
const res = await page.goto(origin + path);
await page.waitForLoadState("networkidle");
let n = 0;
const shot = async (label) => {
  n += 1;
  const f = `${out}/${run}-${String(n).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: f, fullPage: false });
  log.push(`screenshot ${f}`);
};
await shot("loaded");
for (const step of steps) {
  const [verb, ...rest] = step.split(":");
  const arg = rest.join(":");
  if (verb === "fill") {
    const [ph, value] = arg.split("=");
    await page.getByPlaceholder(ph).fill(value ?? "");
  } else if (verb === "click") await page.getByRole("button", { name: arg }).click();
  else if (verb === "link") await page.getByRole("link", { name: arg }).first().click();
  else if (verb === "press") await page.keyboard.press(arg);
  else if (verb === "expect")
    await page.getByText(arg).first().waitFor({ state: "visible", timeout: 15000 });
  else if (verb === "goto") await page.goto(origin + arg);
  else throw new Error(`unknown step ${step}`);
  await page.waitForLoadState("networkidle");
  log.push(`step ok ${step}`);
  await shot(verb);
}
const summary = {
  url: page.url(),
  status: res?.status(),
  h1: await page.locator("h1").first().textContent(),
  steps,
  log,
};
await writeFile(`${out}/${run}-drive.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
if (log.some((l) => l.startsWith("pageerror"))) process.exit(1);
