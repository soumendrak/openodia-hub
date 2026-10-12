import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const result = [];
const fixture = {
  year: "2026",
  date: "12 Nov 2026",
  title: "Live beyond first page",
  url: "https://example.com/live-beyond",
  community: "GDGoC KIIT",
  type: "Workshop",
  description: "Remote complete-corpus fixture",
  startDate: "2026-11-12",
};
const firstPageEvent = {
  ...fixture,
  title: "Loaded first page event",
  url: "https://example.com/loaded-first-page",
  community: "GDG Bhubaneswar",
  type: "Talk",
};
await page.route("**/api/events*", (route) => {
  const pageNumber = new URL(route.request().url()).searchParams.get("page");
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      events:
        pageNumber === "1" ? [firstPageEvent] : pageNumber ? [fixture] : [firstPageEvent, fixture],
      total: 2,
      ...(pageNumber === "1" ? { nextCursor: "2" } : {}),
    }),
  });
});
for (const port of [9108, 9109])
  for (const path of port === 9108
    ? ["/contribute", "/events"]
    : ["/communities", "/events?community=gdgoc-kiit&type=Workshop"])
    for (const theme of ["light", "dark"])
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`http://localhost:${port}${path}`);
        await page.waitForSelector("h1");
        await page.evaluate((t) => {
          localStorage.setItem("theme", t);
          document.documentElement.classList.toggle("dark", t === "dark");
        }, theme);
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        if (overflow > 0) throw new Error(`${port}${path}/${theme}/${width} overflow ${overflow}`);
        result.push({ port, path, theme, width, overflow });
      }
await page.goto("http://localhost:9109/communities?q=kiit");
await page.getByRole("link", { name: "View events from GDGoC KIIT" }).click();
await page.waitForURL("**/events?community=gdgoc-kiit");
await page.getByText("Live beyond first page").waitFor();
if (await page.locator("a a").count()) throw Error("Nested anchor");
await page.reload();
await page.getByText("Live beyond first page").waitFor();
await page.getByRole("button", { name: "Clear Filters" }).click();
await page.getByText("Loaded first page event").waitFor();
if (await page.getByText("Live beyond first page").count())
  throw Error("Cleared filters kept the cached full corpus");
await page.getByRole("button", { name: "Load more" }).click();
await page.getByText("Live beyond first page").waitFor();
await page.goto("http://localhost:9109/events?community=gdgoc-kiit");
await page.getByText("Live beyond first page").waitFor();
await page.getByLabel("Filter by event type").selectOption("Workshop");
await page.getByPlaceholder("Search events… [/]").fill("KIIT");
await page.waitForURL("**q=KIIT**");
await page.getByText("Live beyond first page").waitFor();
await page.getByRole("link", { name: "GDGoC KIIT", exact: true }).first().click();
await page.waitForURL("**/communities#gdgoc-kiit");
await page.goBack();
await page.getByText("Live beyond first page").waitFor();
await page.goForward();
await page.waitForURL("**/communities#gdgoc-kiit");
for (const theme of ["light", "dark"]) {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`http://localhost:9109/events?community=${"x".repeat(80)}`);
  await page.getByRole("status").filter({ hasText: "not a known organizer" }).waitFor();
  await page.evaluate(
    (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
    theme,
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0)
    throw new Error(`Long unknown organizer ID overflows ${theme} by ${overflow}px`);
  result.push({
    port: 9109,
    path: "/events?community=<80-character unknown ID>",
    theme,
    width: 320,
    overflow,
  });
}
await page.goto("http://localhost:9109/events?community=unknown-id");
await page.getByRole("status").filter({ hasText: "not a known organizer" }).waitFor();
if (await page.locator("article").count()) throw Error("Unknown ID selected events");
await page.goto("http://localhost:9109/communities?q=kiit");
await page.waitForTimeout(700);
await page.locator("h1").click();
await page.keyboard.press("/");
if (await page.getByRole("searchbox").evaluate((el) => el !== document.activeElement))
  throw Error("Shortcut failed");
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
await page.getByRole("searchbox").evaluate((el) => {
  if (el !== document.activeElement) throw Error("Clear did not refocus");
});
await mkdir("docs/verification/browser-community-workflows", { recursive: true });
await page.screenshot({
  path: "docs/verification/browser-community-workflows/directory.png",
  fullPage: true,
});
for (const form of ["event-submission.yml", "organizer-submission.yml", "event-correction.yml"]) {
  await page.goto(`https://github.com/soumendrak/openodia-hub/issues/new?template=${form}`);
  result.push({
    form,
    url: page.url(),
    text: (await page.locator("body").innerText()).slice(-300),
  });
}
await writeFile(
  "docs/verification/browser-community-workflows/results.json",
  JSON.stringify({ result, errors }, null, 2),
);
await browser.close();
console.log(JSON.stringify({ checks: result.length, errors }));
