/**
 * Renders public/openodia-og.svg to public/openodia-og.png at 1200×630.
 *
 * Facebook, X, and LinkedIn don't render SVG link previews, so the social
 * meta tags need a raster image. Run after editing the SVG:
 *   bun scripts/build-og-image.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SVG = new URL("../public/openodia-og.svg", import.meta.url);
const PNG = fileURLToPath(new URL("../public/openodia-og.png", import.meta.url));

const svg = readFileSync(SVG, "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(
  `<!doctype html><style>html,body{margin:0;padding:0;background:#0a0a14}svg{display:block}</style>${svg.replace(
    "<svg ",
    '<svg width="1200" height="630" ',
  )}`,
  { waitUntil: "load" },
);
await page.screenshot({ path: PNG, type: "png" });
await browser.close();
console.log(`wrote ${PNG}`);
