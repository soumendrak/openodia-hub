import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** Recorded responses for the same-origin APIs pages call after hydration. */
const apiFixtures = readFileSync(new URL("fixtures/api-events.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { path: string; body: unknown });

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
  test(`${path} renders`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    );
    for (const { path: api, body } of apiFixtures) {
      await page.route(`${origin}${api}?*`, (route) => route.fulfill({ json: body }));
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path);

    expect(response?.status()).toBe(status);
    await expect(page.locator("h1")).toHaveText(heading);
    await expect(page).toHaveTitle(/\S/);
    if (text) await expect(page.getByText(text).first()).toBeVisible();
    // The <h1> is already in the SSR HTML; let hydration and its client requests settle
    // so errors thrown after they resolve are caught too.
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}
