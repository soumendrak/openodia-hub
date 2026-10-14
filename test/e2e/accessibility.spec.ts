import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
import AxeBuilder from "@axe-core/playwright";
for (const theme of ["light", "dark"] as const)
  for (const width of [320, 390, 768, 1440]) {
    test(`keyboard landmarks and navigation ${theme} ${width}px`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.route(
        (u) => u.origin !== new URL(baseURL!).origin,
        (r) => r.abort(),
      );
      await page.goto("/about");
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip).toBeFocused();
      expect(await skip.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
      await page.getByRole("button", { name: "Switch language" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "or");
      await expect(page.locator("main")).toHaveAttribute("lang", "en");
      await expect(page.locator("header")).toHaveAttribute("lang", "or");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
      const opener = page.getByRole("button", { name: /ସନ୍ଧାନ|search/i });
      await opener.click();
      await expect(page.getByRole("dialog")).toHaveAccessibleName("Search OpenOdia");
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page.getByRole("dialog").evaluate((el) => el.contains(document.activeElement)),
        ).toBe(true);
      }
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    });
  }
test("editor Escape releases tab navigation and reduced motion removes entrance animation", async ({
  page,
  baseURL,
}) => {
  await page.route(
    (u) => u.origin !== new URL(baseURL!).origin,
    (r) => r.abort(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/playground");
  await page.waitForLoadState("networkidle");
  const editor = page.getByRole("textbox", { name: /code editor/ });
  await editor.focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor).not.toBeFocused();
  expect(
    await page
      .locator(".anim-in")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("marquee controls reflect motion preference and editor reentry restores indentation", async ({
  page,
  baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const control = page.locator(".marquee-control");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  await expect(control).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(control).toBeVisible();
  await control.click();
  await expect(control).toHaveAccessibleName("Resume scrolling");
  await expect(control).not.toHaveAttribute("aria-pressed");
  expect(
    await page
      .locator(".animate-marquee")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("paused");
  await control.click();
  expect(
    await page
      .locator(".animate-marquee")
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe("running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(control).toBeHidden();
  expect(
    await page.locator(".animate-marquee").evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.goto("/playground");
  await page.waitForLoadState("networkidle");
  const editor = page.getByRole("textbox", { name: /code editor/ });
  await editor.focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor).not.toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(editor).toBeFocused();
  const before = await editor.inputValue();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  expect((await editor.inputValue()).length).toBe(before.length + 4);
  await editor.fill("    print(1)");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+Tab");
  await expect(editor).not.toBeFocused();
  await expect(editor).toHaveValue("    print(1)");
  await editor.focus();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("    print(1)    ");
});

test("Odia fragments and locale control name keep their language boundaries", async ({
  page,
  baseURL,
}) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  for (const path of ["/", "/about", "/contribute"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const fragments = page.locator('main span[lang="or"]');
    expect(await fragments.count()).toBeGreaterThan(0);
    expect(await fragments.allTextContents()).toContain(path === "/" ? "ଓ" : "ଓଡ଼ିଆ");
  }
  const toggle = page.locator("header button[aria-labelledby]");
  for (const locale of ["en", "or"]) {
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const nameLanguages = await toggle.evaluate((el) =>
      el
        .getAttribute("aria-labelledby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.lang),
    );
    expect(nameLanguages).toEqual([locale, locale === "en" ? "or" : "en"]);
    await expect(toggle).not.toHaveAttribute("aria-label");
    await toggle.click();
  }
});
