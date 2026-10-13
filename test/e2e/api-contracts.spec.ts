import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
});
for (const [path, key] of [
  ["repos", "repos"],
  ["models", "models"],
  ["datasets", "datasets"],
  ["awesome", "items"],
  ["videos", "channels"],
  ["resources", "resources"],
  ["events", "events"],
  ["contributors", "contributors"],
]) {
  test(`built Worker /api/${path} returns its JSON contract`, async ({ request }) => {
    const response = await request.get(`/api/${path}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    const body = await response.json();
    expect(Array.isArray(body[key])).toBe(true);
    if (!["contributors"].includes(path)) {
      expect(body[key].length).toBeGreaterThan(0);
      const required: Record<string, string[]> = {
        repos: ["full_name", "html_url"],
        models: ["id", "url"],
        datasets: ["id", "url"],
        awesome: ["name", "url"],
        videos: ["name", "videos"],
        resources: ["key", "kind", "name", "url"],
        events: ["title", "url", "startDate"],
      };
      for (const item of body[key])
        for (const field of required[path]) expect(item).toHaveProperty(field);
    }
  });
}
test("search validates input and finds recorded models", async ({ request }) => {
  for (const [query, error] of [
    ["", "query_required"],
    ["?q=odia&kind=unknown", "invalid_kind"],
    [`?q=${"x".repeat(81)}`, "query_too_long"],
  ]) {
    const response = await request.get(`/api/search${query}`);
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error });
  }
  const response = await request.get("/api/search?q=xlm&kind=model");
  expect(response.ok()).toBe(true);
  expect((await response.json()).results.some((r: { kind: string }) => r.kind === "model")).toBe(
    true,
  );
});
test("discovery, text, feeds, pagination and recorded PyPI contract", async ({ request }) => {
  for (const path of [
    "/.well-known/openapi.json",
    "/.well-known/api-catalog",
    "/sitemap.xml",
    "/llms.txt",
    "/llms-full.txt",
    "/events-feed",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(20);
  }
  const response = await request.get("/api/resources?limit=1");
  const body = await response.json();
  expect(body.resources).toHaveLength(1);
  expect(body.total).toBeGreaterThan(1);
  expect(await (await request.get("/api/pypi")).json()).toMatchObject({
    version: "0.2.0",
    releases: 2,
  });
});
test("cold Worker reports upstream failures rather than empty model/dataset success", async ({
  request,
  baseURL,
}) => {
  const outage = new URL(baseURL!);
  outage.port = String(Number(outage.port) + 1);
  for (const path of ["models", "datasets", "repos"]) {
    const response = await request.get(`${outage}/api/${path}`);
    expect(response.status()).toBe(503);
    expect(await response.json()).toHaveProperty("error");
  }
});

test("MCP tool discovery uses the built Worker protocol endpoint", async ({ request }) => {
  const response = await request.post("/mcp", {
    headers: { Accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toContain('"tools"');
  expect(text).toContain('"jsonrpc":"2.0"');
});

test("Worker and browser share the deterministic fixture clock", async ({ page, request }) => {
  const clock = await (await request.get("/__fixture-clock")).json();
  await page.goto("/about");
  const browser = await page.evaluate(() => ({ now: Date.now(), iso: new Date().toISOString() }));
  expect(clock).toEqual({ now: 1791763200000, iso: "2026-10-12T00:00:00.000Z" });
  expect(browser).toEqual(clock);
});
