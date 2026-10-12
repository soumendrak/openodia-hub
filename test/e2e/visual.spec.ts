import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
for (const path of ["/", "/tools", "/models", "/datasets", "/events", "/playground"]) {
  test(`visual ${path}`, async ({ page, baseURL }) => {
    await page.route(
      (url) => url.origin !== new URL(baseURL!).origin,
      (route) => route.abort(),
    );
    await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
    await page.route("**/__e2e_fonts/*", (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop()!;
      return route.fulfill({
        contentType: "font/ttf",
        body: readFileSync(new URL(`fonts/${name}`, import.meta.url)),
      });
    });
    await page.goto(path);
    await page.addStyleTag({
      content: `
      @font-face {font-family:"Cormorant Garamond";src:url("/__e2e_fonts/display.ttf");font-weight:100 900;}
      @font-face {font-family:"Cormorant Garamond";src:url("/__e2e_fonts/display-italic.ttf");font-style:italic;font-weight:100 900;}
      @font-face {font-family:"Inter";src:url("/__e2e_fonts/body.ttf");font-weight:100 900;}
      @font-face {font-family:"Noto Sans Oriya";src:url("/__e2e_fonts/odia.ttf");font-weight:100 900;}
    `,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    const platform =
      process.platform === "linux" && ["/", "/playground"].includes(path) ? "linux-" : "";
    await expect(page).toHaveScreenshot(`${platform}${path === "/" ? "home" : path.slice(1)}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    });
  });
}
