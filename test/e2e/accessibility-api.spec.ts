import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
test("native API fixtures support accessible catalogs and dialog search", async ({ request }) => {
  for (const [endpoint, key] of [
    ["models", "models"],
    ["datasets", "datasets"],
    ["events", "events"],
    ["resources", "resources"],
  ]) {
    const response = await request.get(`/api/${endpoint}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    const json = await response.json();
    expect(Array.isArray(json[key])).toBe(true);
    expect(json[key].length).toBeGreaterThan(0);
  }
  const search = await request.get("/api/search?q=xlm&kind=model");
  expect(search.status()).toBe(200);
  expect((await search.json()).results.length).toBeGreaterThan(0);
});

test("event filter changes announce the resulting count", async ({ page, baseURL }) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.goto("/events");
  await page.waitForLoadState("networkidle");
  const region = page.getByRole("status").filter({ hasNotText: /Showing/ });
  await expect(region).toHaveCount(1);
  await expect(region).toHaveText(/^\d+ events? shown$/);
  const unfilteredCount = await region.textContent();
  await region.evaluate((el) => el.setAttribute("data-present-before-filter", "true"));
  await page.getByRole("searchbox", { name: "Search events" }).fill("fixture-no-match-93817");
  await expect(region).toHaveText("0 events matched");
  await expect(region).toHaveAttribute("data-present-before-filter", "true");
  await expect(page.getByRole("status")).toHaveAttribute("aria-live", "polite");
  await page.getByRole("button", { name: "Clear Filters" }).click();
  await expect(region).toHaveText(unfilteredCount!);
  await expect(region).toHaveAttribute("data-present-before-filter", "true");
});

test("small directory clear controls have a usable target and return focus", async ({
  page,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.goto("/communities");
  await page.waitForLoadState("networkidle");
  const input = page.getByRole("searchbox");
  await input.fill("KIIT");
  const clear = page.getByRole("button", { name: "Clear search" });
  const box = await clear.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(24);
  expect(box!.height).toBeGreaterThanOrEqual(24);
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});

for (const withLenis of [false, true]) {
  test(`reduced-motion timeline navigation uses instant native scrolling with Lenis=${withLenis}`, async ({
    page,
    baseURL,
  }) => {
    await page.route(
      (url) => url.origin !== new URL(baseURL!).origin,
      (route) => route.abort(),
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    await page.evaluate((useLenis) => {
      const state = { native: [] as ScrollToOptions[], lenis: 0 };
      const nativeScroll = window.scrollTo.bind(window);
      Object.assign(window, {
        scrollProof: state,
        lenis: useLenis
          ? {
              scrollTo: () => {
                state.lenis += 1;
              },
            }
          : undefined,
        scrollTo: (options: ScrollToOptions) => {
          state.native.push(options);
          nativeScroll(options);
        },
      });
    }, withLenis);
    await page
      .getByRole("heading", { name: "Timeline", exact: true })
      .locator("..")
      .getByText("Upcoming", { exact: true })
      .click();
    const proof = await page.evaluate(
      () =>
        (
          window as unknown as {
            scrollProof: { native: ScrollToOptions[]; lenis: number };
          }
        ).scrollProof,
    );
    expect(proof.native).toContainEqual({ top: expect.any(Number), behavior: "instant" });
    expect(proof.lenis).toBe(0);
  });
}

test("skip link remains the first Tab stop after scroll-to-top appears", async ({
  page,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await expect(page.getByRole("button", { name: "Scroll to top" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

for (const theme of ["light", "dark"] as const)
  test(`facet popover has a name and Escape returns focus (${theme})`, async ({
    page,
    baseURL,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.route(
      (url) => url.origin !== new URL(baseURL!).origin,
      (route) => route.abort(),
    );
    await page.goto("/models");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: "Filter by Task" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Filter by Task" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("lang", "en");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

test("locale toggle includes its visible target-language text in its accessible name", async ({
  page,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
  const toggle = page.locator("header button").filter({ has: page.locator("span[lang]") });
  for (let i = 0; i < 2; i++) {
    const label = (await toggle.locator("span:not(.sr-only)").innerText()).trim();
    await expect(toggle).toHaveAccessibleName(new RegExp(label));
    await toggle.click();
  }
});

test("Worker and browser share the deterministic fixture clock", async ({
  page,
  request,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  const clock = await (await request.get("/__fixture-clock")).json();
  await page.goto("/about");
  const browser = await page.evaluate(() => ({ now: Date.now(), iso: new Date().toISOString() }));
  expect(clock).toEqual({ now: 1791763200000, iso: "2026-10-12T00:00:00.000Z" });
  expect(browser).toEqual(clock);
});

test("mixed Odia video titles retain separate language runs in both UI locales", async ({
  page,
  request,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  const payload = await (await request.get("/api/videos")).json();
  const video = payload.channels
    .flatMap((channel: { videos: { id: string; title: string }[] }) => channel.videos)
    .find((item: { id: string }) => item.id === "Au8Q2WQp4_I");
  expect(video.title).toContain("ଏଆଇ");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const link = page.locator('a[href="https://www.youtube.com/watch?v=Au8Q2WQp4_I"]');
  for (const locale of ["en", "or"]) {
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(link.locator("h3")).toHaveText(video.title);
    await expect(link.locator('h3 span[lang="or"]').first()).toHaveText("ଏଆଇ");
    await expect(link.locator('h3 span[lang="en"]').last()).toContainText("How to make a website");
    await expect(link.locator("img")).toHaveAttribute("alt", "");
    if (locale === "en") await page.locator("header button[aria-labelledby]").click();
  }
});
