/**
 * SPDX license normalisation across the three catalog sources.
 *
 * Each source states the license differently: GitHub gives `license.spdx_id`,
 * Hugging Face gives a `license:apache-2.0` tag, and Awesome-Odia-AI mentions
 * it in prose ("… (Apache-2.0)."). This maps all three onto one canonical id
 * so a single badge and a single facet cover the whole directory.
 *
 * The list is deliberately closed: an unrecognised string yields "" rather
 * than a guess, because a wrong license badge is worse than none.
 */

/** Canonical SPDX ids, keyed by their lowercase form. */
const SPDX: Record<string, string> = {
  mit: "MIT",
  "apache-2.0": "Apache-2.0",
  "bsd-2-clause": "BSD-2-Clause",
  "bsd-3-clause": "BSD-3-Clause",
  "gpl-2.0": "GPL-2.0",
  "gpl-3.0": "GPL-3.0",
  "agpl-3.0": "AGPL-3.0",
  "lgpl-2.1": "LGPL-2.1",
  "lgpl-3.0": "LGPL-3.0",
  "mpl-2.0": "MPL-2.0",
  unlicense: "Unlicense",
  "cc0-1.0": "CC0-1.0",
  "cc-by-2.0": "CC-BY-2.0",
  "cc-by-3.0": "CC-BY-3.0",
  "cc-by-4.0": "CC-BY-4.0",
  "cc-by-sa-3.0": "CC-BY-SA-3.0",
  "cc-by-sa-4.0": "CC-BY-SA-4.0",
  "cc-by-nc-4.0": "CC-BY-NC-4.0",
  "cc-by-nc-sa-4.0": "CC-BY-NC-SA-4.0",
  "openrail++": "OpenRAIL++",
  openrail: "OpenRAIL",
  "llama3.1": "Llama-3.1",
  "llama3.2": "Llama-3.2",
  gemma: "Gemma",
  isc: "ISC",
  "ofl-1.1": "OFL-1.1",
  "epl-2.0": "EPL-2.0",
};

/** Licenses that permit reuse in a paper or product without a share-alike or non-commercial clause. */
const PERMISSIVE = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-2.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "OFL-1.1",
  "MPL-2.0",
]);

export function isPermissive(spdx: string): boolean {
  return PERMISSIVE.has(spdx);
}

/**
 * Canonicalise a license string that a source already identified as such
 * (a GitHub `spdx_id`, an HF `license:` tag value). Returns "" for
 * NOASSERTION, "other", and anything not in the table.
 */
export function normalizeSpdx(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  if (!key || key === "noassertion" || key === "other" || key === "unknown") return "";
  return SPDX[key] ?? "";
}

// Longest-first so "cc-by-sa-4.0" wins over "cc-by-4.0" style prefixes, and
// "apache-2.0" is not shadowed by a shorter neighbour.
const PROSE_KEYS = Object.keys(SPDX).sort((a, b) => b.length - a.length);
const PROSE_RE = new RegExp(
  `(?:^|[\\s(\\[])(${PROSE_KEYS.map((k) => k.replace(/[.+]/g, "\\$&")).join("|")})(?:\\s+license)?(?=$|[\\s).,\\]])`,
  "i",
);

/**
 * Best-effort license extraction from free prose — Awesome-Odia-AI states it
 * inline, e.g. "… (Apache-2.0)." or "… (MIT license)". Anything that isn't a
 * bare, recognised SPDX id is left unlabelled.
 */
export function licenseFromProse(text: string | null | undefined): string {
  if (!text) return "";
  const m = PROSE_RE.exec(text);
  return m ? normalizeSpdx(m[1]) : "";
}
