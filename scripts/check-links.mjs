/**
 * Link-checks the curated catalog.
 *
 * Dead links are the known trust-killer of awesome-lists, and nothing on the
 * site can tell a live entry from a 404 — the directory renders both the same.
 * This runs weekly in CI and fails loudly with the list of dead URLs.
 *
 *   bun scripts/check-links.mjs            # check everything
 *   bun scripts/check-links.mjs --json     # machine-readable report
 *
 * Exit code 1 when anything is dead, so CI surfaces it.
 */

const LIST_BASE = "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main";
const README_URL = `${LIST_BASE}/README.md`;
const CONFIG_URL = `${LIST_BASE}/.markdown-link-check.json`;
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;
const RETRIES = 1;

const UA = "openodia.com link checker (+https://github.com/soumendrak/openodia-hub)";

/** Hosts that answer HEAD with a 4xx but are fine on GET. */
const GET_ONLY = /(^|\.)(huggingface\.co|arxiv\.org|aclanthology\.org)$/i;

export async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkOne(url) {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();
  const method = GET_ONLY.test(host) ? "GET" : "HEAD";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      let res = await fetchWithTimeout(url, { method, headers: { "User-Agent": UA } });
      // Some hosts reject HEAD outright; a GET is the honest second try.
      if (method === "HEAD" && res.status >= 400 && res.status < 500) {
        res = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": UA } });
      }
      if (res.ok) return { url, ok: true, status: res.status };
      // The resource exists but is gated (a login-walled HF repo, say). That is
      // worth reporting but it is not a dead link.
      if (res.status === 401 || res.status === 403) {
        return { url, ok: true, status: res.status, restricted: true };
      }
      // 429 is us, not them.
      if (res.status === 429 && attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (res.status === 429) return { url, ok: true, status: 429, rateLimited: true };
      return { url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    } catch (err) {
      if (attempt < RETRIES) continue;
      return {
        url,
        ok: false,
        status: 0,
        reason: err?.name === "AbortError" ? "timeout" : String(err),
      };
    }
  }
  return { url, ok: false, status: 0, reason: "unreachable" };
}

export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function skipPatterns(config) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("the config is not a JSON object");
  }
  if (!Object.hasOwn(config, "ignorePatterns")) return [];
  const entries = config.ignorePatterns;
  if (!Array.isArray(entries)) throw new Error("ignorePatterns is not an array");
  return entries.map((entry, index) => {
    const pattern = entry?.pattern;
    if (typeof pattern !== "string" || pattern === "") {
      throw new Error(
        `ignorePatterns[${index}] needs a non-empty string "pattern": ${JSON.stringify(entry)}`,
      );
    }
    try {
      return new RegExp(pattern);
    } catch {
      throw new Error(`ignorePatterns[${index}] is not a valid regular expression: ${pattern}`);
    }
  });
}

export async function loadSkipPatterns() {
  let res;
  try {
    res = await fetchWithTimeout(CONFIG_URL, { headers: { "User-Agent": UA } });
  } catch (err) {
    throw new Error(`it could not be fetched: ${String(err)}`);
  }
  if (!res.ok) throw new Error(`it could not be fetched: HTTP ${res.status}`);
  let body;
  try {
    body = await res.text();
  } catch (err) {
    throw new Error(`it could not be fetched: ${String(err)}`);
  }
  let config;
  try {
    config = JSON.parse(body);
  } catch (err) {
    throw new Error(`it is not valid JSON: ${String(err)}`);
  }
  return skipPatterns(config);
}

export function extractUrls(markdown) {
  const urls = new Set();
  for (const [, url] of markdown.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    urls.add(url.replace(/[.,;]+$/, ""));
  }
  return [...urls];
}

export async function main() {
  const json = process.argv.includes("--json");

  let markdown;
  try {
    const res = await fetchWithTimeout(README_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    markdown = await res.text();
  } catch (err) {
    console.error(`Could not fetch the Awesome-Odia-AI README: ${err.message}`);
    process.exit(2);
  }
  let skips;
  try {
    skips = await loadSkipPatterns();
  } catch (err) {
    console.error(`Could not use the Awesome-Odia-AI link-check config: ${err.message}`);
    process.exit(2);
  }
  const listed = extractUrls(markdown);
  const skipped = listed.filter((url) => skips.some((pattern) => pattern.test(url)));
  const urls = listed.filter((url) => !skipped.includes(url));
  if (listed.length === 0) {
    console.error("The Awesome-Odia-AI README lists no links, so nothing would be checked.");
    process.exit(2);
  }
  if (urls.length === 0) {
    console.error(
      `The Awesome-Odia-AI link-check config skips all ${listed.length} listed links, so nothing would be checked.`,
    );
    process.exit(2);
  }
  if (!json) console.log(`Checking ${urls.length} links…`);

  const results = await mapWithConcurrency(urls, CONCURRENCY, checkOne);
  const dead = results.filter((r) => !r.ok);
  const restricted = results.filter((r) => r.restricted);
  const rateLimited = results.filter((r) => r.rateLimited);

  if (json) {
    console.log(
      JSON.stringify({ checked: results.length, dead, restricted, rateLimited, skipped }, null, 2),
    );
  } else if (dead.length === 0) {
    console.log(`All ${results.length} links resolve.`);
  } else {
    console.log(`\n${dead.length} of ${results.length} links are dead:\n`);
    for (const d of dead) console.log(`  ${d.reason.padEnd(12)} ${d.url}`);
  }

  if (restricted.length > 0 && !json) {
    console.log(`\n${restricted.length} link(s) exist but require authentication:`);
    for (const r of restricted) console.log(`  HTTP ${r.status}     ${r.url}`);
  }

  if (rateLimited.length > 0 && !json) {
    console.log(
      `\n${rateLimited.length} link(s) stayed rate limited (HTTP 429) and count as alive:`,
    );
    for (const r of rateLimited) console.log(`  ${r.url}`);
  }

  if (skipped.length > 0 && !json) {
    console.log(`\n${skipped.length} link(s) skipped by the Awesome-Odia-AI link-check config:`);
    for (const url of skipped) console.log(`  ${url}`);
  }

  process.exit(dead.length > 0 ? 1 : 0);
}

if (process.argv[1]?.endsWith("check-links.mjs")) {
  await main();
}
