/**
 * Seeds the local CATALOG_KV with recorded upstream responses (fixtures/catalog-kv.jsonl)
 * so SSR serves them from `cachedJson` instead of fanning out to GitHub, Hugging Face,
 * OpenAlex… Live upstreams made the smoke suite slow and flaky; this makes it hermetic.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PERSIST_DIR = ".wrangler/e2e"; // must match --persist-to in playwright.config.ts

const at = Date.now(); // fresh, so nothing is past its TTL and refreshed in the background
const entries = readFileSync(new URL("fixtures/catalog-kv.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { key: string; value: unknown })
  .map(({ key, value }) => ({ key: `cache:v3:${key}`, value: JSON.stringify({ at, value }) }));

rmSync(PERSIST_DIR, { recursive: true, force: true });
const dir = mkdtempSync(join(tmpdir(), "e2e-kv-"));
const file = join(dir, "bulk.json");
writeFileSync(file, JSON.stringify(entries));
const args = ["kv", "bulk", "put", file, "--binding", "CATALOG_KV", "--local"];
args.push("-c", "dist/server/wrangler.json", "--persist-to", PERSIST_DIR);
execFileSync("bunx", ["wrangler", ...args], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
