import { expect, test } from "@playwright/test";
import { smokeRoute } from "./smoke";
smokeRoute("/r/model/FacebookAI/xlm-roberta-base", "xlm-roberta-base");
smokeRoute("/r/gh/soumendrak/MTEnglish2Odia", "MTEnglish2Odia", {
  text: "Machine Translation from English to Odia language.",
});
smokeRoute("/r/invalid/nope", "404", { status: 404 });

test("every resource permalink the API lists opens its detail page", async ({ request }) => {
  const response = await request.get("/api/resources?q=sua");
  const { resources }: { resources: { permalink: string }[] } = await response.json();
  expect(resources.map(({ permalink }) => permalink)).toEqual(["/r/gh/soumendrak/MTEnglish2Odia"]);
  for (const { permalink } of resources) expect((await request.get(permalink)).status()).toBe(200);
});
