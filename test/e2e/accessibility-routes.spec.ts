import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
import AxeBuilder from "@axe-core/playwright";
for (const theme of ["light", "dark"] as const)
  for (const path of [
    "/",
    "/tools",
    "/models",
    "/datasets",
    "/events",
    "/playground",
    "/tutorials",
    "/papers",
    "/treebank",
    "/communities",
    "/about",
    "/contribute",
    "/api",
    "/r/model/FacebookAI/xlm-roberta-base",
    "/unknown-route",
  ]) {
    test(`WCAG ${theme} ${path}`, async ({ page, baseURL }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.route(
        (url) => url.origin !== new URL(baseURL!).origin,
        (route) => route.abort(),
      );
      const response = await page.goto(path);
      expect(response?.status()).toBe(path === "/unknown-route" ? 404 : 200);
      await page.waitForLoadState("networkidle");
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
    });
  }
