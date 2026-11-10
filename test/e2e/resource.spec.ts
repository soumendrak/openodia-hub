import { expect, test } from "@playwright/test";
import { smokeRoute } from "./smoke";
smokeRoute("/r/model/FacebookAI/xlm-roberta-base", "xlm-roberta-base");
smokeRoute("/r/gh/soumendrak/MTEnglish2Odia", "MTEnglish2Odia", {
  text: "Machine Translation from English to Odia language.",
});
smokeRoute("/r/invalid/nope", "404", { status: 404 });

test("every resource permalink the API lists opens its detail page", async ({ request }) => {
  const response = await request.get("/api/resources");
  const { resources }: { resources: { permalink?: string }[] } = await response.json();
  const permalinks = resources.flatMap(({ permalink }) => (permalink ? [permalink] : []));
  expect(permalinks).toHaveLength(7);
  expect(permalinks).toContain("/r/gh/soumendrak/MTEnglish2Odia");
  for (const permalink of permalinks) expect((await request.get(permalink)).status()).toBe(200);
});

test("a GitHub detail page shows the upstream stars and license", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  await page.goto("/r/gh/soumendrak/MTEnglish2Odia");
  const facts = page.locator("div", {
    has: page.locator(":scope > span", { hasText: /^Jupyter Notebook$/ }),
  });
  await expect(facts.getByText("10", { exact: true })).toBeVisible();
  await expect(facts.getByText("GPL-3.0", { exact: true })).toBeVisible();
});
