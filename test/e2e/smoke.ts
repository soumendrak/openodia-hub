import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * One route loads with the expected status and <h1>, shows `text` from the recorded
 * fixtures when given, and throws no uncaught page errors. Third-party requests (fonts,
 * analytics, CDNs, images) are aborted so the result never depends on the network.
 */
export function smokeRoute(
  path: string,
  heading: string | RegExp,
  { status = 200, text }: { status?: number; text?: string } = {},
) {
  for (const theme of ["light", "dark"] as const)
    test(`${path} renders (${theme})`, async ({ page, baseURL }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const origin = new URL(baseURL!).origin;
      await page.route(
        (url) => url.origin !== origin,
        (route) => route.abort(),
      );
      const errors: string[] = [];
      const hydrationErrors: string[] = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /hydrat|react error|server rendered|did not match/i.test(message.text())
        )
          hydrationErrors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
      const response = await page.goto(path);

      expect(response?.status()).toBe(status);
      await expect(page.locator("h1")).toHaveText(heading);
      await expect(page).toHaveTitle(/\S/);
      if (text) await expect(page.getByText(text).first()).toBeVisible();
      // The <h1> is already in the SSR HTML; let hydration and its client requests settle
      // so errors thrown after they resolve are caught too.
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
      expect(hydrationErrors).toEqual([]);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
    });
}
