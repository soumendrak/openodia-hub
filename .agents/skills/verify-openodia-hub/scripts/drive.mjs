import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const port = process.env.VERIFY_PORT ?? "9171";
const out = process.env.VERIFY_EVIDENCE ?? `/tmp/verify-openodia-hub/${port}`;
const origin = `http://127.0.0.1:${port}`;
const [startPath = "/", ...steps] = process.argv.slice(2);
const run = Date.now();
const allowedFailures = new Set(
  (process.env.VERIFY_ALLOW_STATUS ?? "")
    .split(",")
    .map((entry) => entry.trim().split(/\s+/).join(" "))
    .filter((entry) => /^\d{3} [A-Z]+ \/\S*$/.test(entry)),
);
const FAILURE_PREFIXES = ["pageerror", "hydration", "httperror", "evidenceerror"];
const HYDRATION_MESSAGE = /hydrat|react error|server rendered|did not match/i;

const splitOnce = (text, separator) => {
  const at = text.indexOf(separator);
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + separator.length)];
};
const pathOf = (url) => new URL(url).pathname;
const isLocal = (url) => new URL(url).origin === origin;
const slug = (text) => text.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "root";
const padded = (n) => String(n).padStart(2, "0");

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const log = [];
const navigations = [];
const pendingSaves = [];
let savedCount = 0;
let shotCount = 0;
let failed = null;
let page;

const saveResponse = async (response) => {
  savedCount += 1;
  const url = new URL(response.url());
  const base = `${out}/${run}-api-${padded(savedCount)}-${slug(url.pathname)}`;
  const request = response.request();
  const meta = {
    url: url.pathname + url.search,
    method: request.method(),
    status: response.status(),
    headers: await response.allHeaders(),
    requestBody: request.postData(),
  };
  await writeFile(`${base}.json`, JSON.stringify(meta, null, 2));
  await writeFile(`${base}.body`, await response.body());
  log.push(`saved ${meta.method} ${meta.url} -> ${base}.body`);
};

const onResponse = (response) => {
  const request = response.request();
  if (request.isNavigationRequest() && request.frame() === page.mainFrame())
    navigations.push({ path: pathOf(response.url()), status: response.status() });
  if (!isLocal(response.url())) return;
  const line = `${response.status()} ${request.method()} ${pathOf(response.url())}`;
  log.push(line);
  if (!["fetch", "xhr"].includes(request.resourceType())) return;
  pendingSaves.push(saveResponse(response).catch((e) => log.push(`evidenceerror ${e.message}`)));
  if (response.status() >= 400 && !allowedFailures.has(line)) log.push(`httperror ${line}`);
};

const waitForHydration = (visited) =>
  page
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
    .catch(() => log.push(`hydration timeout: no React onClick in the header after ${visited}`));

const visit = async (path) => {
  const response = await page.goto(origin + path);
  if (!response) navigations.push({ path, status: null });
  await page.waitForLoadState("networkidle");
  await waitForHydration(path);
};

const screenshot = async (label) => {
  shotCount += 1;
  const file = `${out}/${run}-${padded(shotCount)}-${label}.png`;
  await page.screenshot({ path: file });
  log.push(`screenshot ${file}`);
};

const expectEqual = (what, got, want) => {
  if (got !== want) throw new Error(`${what} is "${got}", want "${want}"`);
};

const followLink = async (name) => {
  const before = page.url();
  await page.getByRole("link", { name }).first().click();
  await page.waitForLoadState("networkidle");
  if (page.url() === before) return;
  const served = await page.request.get(page.url());
  navigations.push({ path: pathOf(page.url()), status: served.status(), via: "link" });
};

const runStep = async (verb, arg) => {
  if (verb === "fill") {
    const [placeholder, value] = splitOnce(arg, "=");
    await page.getByPlaceholder(placeholder).fill(value);
  } else if (verb === "click") await page.getByRole("button", { name: arg }).click();
  else if (verb === "link") await followLink(arg);
  else if (verb === "press") await page.keyboard.press(arg);
  else if (verb === "expect")
    await page.getByText(arg).first().waitFor({ state: "visible", timeout: 15000 });
  else if (verb === "goto") await visit(arg);
  else if (verb === "reload") {
    const here = new URL(page.url());
    await visit(here.pathname + here.search);
  } else if (verb === "storage") {
    const [key, want] = splitOnce(arg, "=");
    expectEqual(
      `localStorage ${key}`,
      await page.evaluate((k) => localStorage.getItem(k), key),
      want,
    );
  } else if (verb === "attr") {
    const [selector, name, want] = arg.split("|");
    const got = await page.locator(selector).first().getAttribute(name, { timeout: 15000 });
    expectEqual(`${selector} ${name}`, got, want);
  } else if (verb === "h1") {
    const heading = (await page.locator("h1").first().textContent({ timeout: 15000 })) ?? "";
    if (!heading.trim().startsWith(arg))
      throw new Error(`h1 "${heading.trim()}" does not start with "${arg}"`);
  } else throw new Error(`unknown step verb "${verb}"`);
};

try {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  page.on("pageerror", (error) => log.push(`pageerror ${error.message}`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && HYDRATION_MESSAGE.test(message.text()))
      log.push(`hydration ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (isLocal(request.url()))
      log.push(`httperror failed ${request.method()} ${pathOf(request.url())}`);
  });
  page.on("response", onResponse);
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
  await visit(startPath);
  await screenshot("loaded");
  for (const step of steps) {
    const [verb, arg] = splitOnce(step, ":");
    try {
      await runStep(verb, arg);
      await page.waitForLoadState("networkidle");
      log.push(`step ok ${step}`);
      await screenshot(verb);
    } catch (error) {
      failed = { step, error: error.message };
      log.push(`step failed ${step}`);
      await screenshot("failed").catch(() => {});
      break;
    }
  }
} catch (error) {
  failed ??= { step: "launch", error: error.message };
} finally {
  for (const result of await Promise.allSettled(pendingSaves))
    if (result.status === "rejected") log.push(`evidenceerror ${result.reason}`);
  const bad =
    failed !== null ||
    log.some((line) => FAILURE_PREFIXES.some((prefix) => line.startsWith(prefix))) ||
    navigations.some(({ status }) => status === null || status >= 400);
  const summary = {
    ok: !bad,
    url: page?.url() ?? null,
    status: navigations.at(-1)?.status ?? null,
    navigations,
    steps,
    failed,
    log,
  };
  await writeFile(`${out}/${run}-drive.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  process.exitCode = bad ? 1 : 0;
}
