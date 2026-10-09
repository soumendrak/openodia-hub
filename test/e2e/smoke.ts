import { expect, test } from "@playwright/test";

/** One route loads with the expected status and <h1>, and throws no uncaught page errors. */
export function smokeRoute(path: string, heading: string | RegExp, status = 200) {
  test(`${path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path);

    expect(response?.status()).toBe(status);
    await expect(page.locator("h1")).toHaveText(heading);
    await expect(page).toHaveTitle(/\S/);
    expect(errors).toEqual([]);
  });
}
