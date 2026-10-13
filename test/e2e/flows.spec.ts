import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
test.beforeEach(async ({ page, baseURL }) => {
  await page.route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => route.abort(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("Odialang executes locally even when the external Python runtime is unavailable", async ({
  page,
}) => {
  await page.goto("/playground");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Odialang", exact: true }).click();
  const editor = page.getByRole("textbox", { name: /Odialang code editor/ });
  await editor.fill('dekha "Browser verification"');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.locator("pre").filter({ hasText: "Browser verification" }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear output" }).click();
  await expect(page.getByText("Output appears here after you click Run.")).toBeVisible();
});
test("directory search filters recorded tools and restores results when cleared", async ({
  page,
}) => {
  await page.goto("/tools");
  await page.waitForLoadState("networkidle");
  const search = page.getByPlaceholder("Search projects, repos, datasets, models… [/]");
  await search.fill("fixture-no-match-93817");
  await expect(page.getByText(/No projects match/).first()).toBeVisible();
  await search.fill("");
  await expect(page.getByText("Sua", { exact: true }).first()).toBeVisible();
});

for (const theme of ["light", "dark"] as const)
  test(`named facet popover is accessible (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
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
