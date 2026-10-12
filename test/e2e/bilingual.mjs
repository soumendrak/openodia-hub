import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
async function waitForHydration(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("header button");
    return (
      button &&
      Object.keys(button).some(
        (key) => key.startsWith("__reactProps") && typeof button[key]?.onClick === "function",
      )
    );
  });
}
const origin = process.env.BILINGUAL_BASE_URL || "http://127.0.0.1:9158";
let server;
if (!process.env.BILINGUAL_BASE_URL) {
  server = spawn(process.execPath, ["test/e2e/serve.mjs"], {
    env: { ...process.env, E2E_PORT: "9158" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      server.kill();
      reject(new Error("Fixture Worker did not become ready"));
    }, 60000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Fixture Worker ready")) {
        clearTimeout(deadline);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(deadline);
      reject(new Error(`Fixture Worker exited ${code}`));
    });
  });
}
const output = process.env.BILINGUAL_OUTPUT || "/tmp/openodia-bilingual-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const checks = [];
try {
  for (const locale of ["en", "or"]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ reducedMotion: "reduce", locale: "tr-TR" });
      await context.addInitScript(
        ({ locale, theme }) => {
          localStorage.setItem("locale", locale);
          localStorage.setItem("theme", theme);
        },
        { locale, theme },
      );
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-12T00:00:00Z"));
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (
          ["error", "warning"].includes(message.type()) &&
          /hydrat|react error|server rendered|did not match/i.test(message.text())
        )
          errors.push(message.text());
      });
      // Static strings and locale controls do not require upstream catalog services.
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      for (const path of ["/", "/translation-status"]) {
        await page.goto(`${origin}${path}`);
        await waitForHydration(page);
        await page.waitForFunction(
          (locale) => document.querySelector("header")?.lang === locale,
          locale,
        );
        if (path === "/") {
          assert.equal(await page.locator(".hero").getAttribute("lang"), locale);
          assert.equal(await page.locator("footer").getAttribute("lang"), locale);
          await page
            .getByRole("heading", { level: 1 })
            .filter({ hasText: locale === "or" ? "ଆମ ଭାଷା" : "Our language" })
            .waitFor();
        } else {
          await page.getByText("46/46 · 100%", { exact: true }).waitFor();
          await page.getByText("0/46 · 0%", { exact: true }).waitFor();
          await page.getByRole("searchbox", { name: "Find a string" }).fill("home.hero.learn");
          await page.getByText("1 strings shown", { exact: true }).waitFor();
          assert.equal(
            await page.locator("main li p[lang=or]").textContent(),
            "ଶିଖିବା ଆରମ୍ଭ କରନ୍ତୁ",
          );
          // The browser's language must not change English/key search case folding.
          await page.getByRole("searchbox").fill("NAV.THEME.ARIA");
          await page.getByText("1 strings shown", { exact: true }).waitFor();
          await page.getByRole("checkbox").check();
          await page.getByRole("searchbox").fill("no-such-key");
          await page.getByText("No matching strings. Clear the search or review filter.").waitFor();
          await page.getByRole("searchbox").fill("");
          await page.getByText("46 strings shown", { exact: true }).waitFor();
        }
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        for (const width of [320, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 812 });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
          );
          const violations = await page.evaluate(async () =>
            (
              await window.axe.run(document, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
              })
            ).violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map((node) => node.target),
            })),
          );
          assert.deepEqual(violations, []);
          checks.push({ locale, theme, path, width, axe: "pass", overflow: "none" });
          if (path === "/translation-status" && width === 320)
            await page.screenshot({ path: `${output}/status-${locale}-${theme}-320.png` });
        }
      }
      await page.goto(`${origin}/`);
      await waitForHydration(page);
      await page.keyboard.press("Control+k");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox").fill("translate");
      await dialog
        .getByRole("option", { name: /Help translate OpenOdia/ })
        .first()
        .click();
      await page.getByRole("heading", { name: "Help translate OpenOdia.", exact: true }).waitFor();
      assert.deepEqual(errors, []);
      const clock = await (await page.request.get(`${origin}/__fixture-clock`)).json();
      assert.equal(clock.now, await page.evaluate(() => Date.now()));
      assert.equal(clock.iso, "2026-10-12T00:00:00.000Z");
      const search = await page.request.get(`${origin}/api/search?q=translate`);
      assert.equal(search.status(), 200);
      assert.ok(
        (await search.json()).results.some((entry) => entry.href === "/translation-status"),
      );
      const sitemap = await page.request.get(`${origin}/sitemap.xml`);
      assert.equal(sitemap.status(), 200);
      assert.match(await sitemap.text(), /\/translation-status<\/loc>/);
      await page.request.get(`${origin}/api/models`);
      const cachedModels = await page.request.get(`${origin}/api/models`);
      assert.match(cachedModels.headers()["x-cache"], /^(MISS|MEMO|KV|STALE)$/);
      const response = await page.request.get(`${origin}/api/translation-status`);
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["access-control-allow-origin"], "*");
      assert.match(response.headers()["cache-control"], /s-maxage=300/);
      assert.equal(response.headers()["x-cache"], undefined);
      const report = await response.json();
      assert.equal(report.total, 46);
      assert.equal(report.translated, 46);
      assert.equal(report.reviewed, 0);
      assert.deepEqual(report.errors, []);
      assert.equal(report.entries.length, 46);
      await context.close();
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ checks, api: "pass" }, null, 2));
  console.log(
    `PASS ${checks.length} bilingual layout/axe checks; Turkish-case search, palette/API/sitemap discovery, cache isolation, locale persistence and recovery`,
  );
} finally {
  await browser.close();
  server?.kill("SIGTERM");
}
