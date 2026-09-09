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
  "ofl-1.0": "OFL-1.0",
  "epl-2.0": "EPL-2.0",
  "cc-by-nd-4.0": "CC-BY-ND-4.0",
  "cc-by-nc-sa-3.0": "CC-BY-NC-SA-3.0",
  "cc-by-nc-nd-4.0": "CC-BY-NC-ND-4.0",
  // Hugging Face's own vocabulary. `bigscience-bloom-rail-1.0` alone tags 100+
  // of the Odia models; leaving it out labelled all of them "No license".
  "bigscience-bloom-rail-1.0": "BigScience-BLOOM-RAIL-1.0",
  "bigscience-openrail-m": "BigScience-OpenRAIL-M",
  "creativeml-openrail-m": "CreativeML-OpenRAIL-M",
  "odc-by": "ODC-By-1.0",
  odbl: "ODbL-1.0",
  "openmdw-1.1": "OpenMDW-1.1",
  "afl-3.0": "AFL-3.0",
  llama2: "Llama-2",
  llama3: "Llama-3",
  // The rest of GitHub's license picker, so a repo that chose one off the
  // standard list is never dropped for being outside this table.
  "0bsd": "0BSD",
  "bsd-4-clause": "BSD-4-Clause",
  "bsl-1.0": "BSL-1.0",
  "artistic-2.0": "Artistic-2.0",
  zlib: "Zlib",
  ncsa: "NCSA",
  postgresql: "PostgreSQL",
  wtfpl: "WTFPL",
  "osl-3.0": "OSL-3.0",
  "ms-pl": "MS-PL",
  "eupl-1.2": "EUPL-1.2",
  "epl-1.0": "EPL-1.0",
  "lppl-1.3c": "LPPL-1.3c",
  vim: "Vim",
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
  "OFL-1.0",
  "MPL-2.0",
  "0BSD",
  "BSD-4-Clause",
  "BSL-1.0",
  "Artistic-2.0",
  "Zlib",
  "NCSA",
  "PostgreSQL",
  "WTFPL",
  "ODC-By-1.0",
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

/**
 * Table keys that are ordinary words in a project blurb. "a Vim plugin",
 * "fine-tuned from Llama-3" and "stored in PostgreSQL" are not license
 * statements, so these are matched only as declared ids, never in prose.
 */
const NOT_IN_PROSE = new Set([
  "vim",
  "zlib",
  "postgresql",
  "ncsa",
  "gemma",
  "llama2",
  "llama3",
  "llama3.1",
  "llama3.2",
  "openrail",
  "openrail++",
]);

// Longest-first so "cc-by-sa-4.0" wins over "cc-by-4.0" style prefixes, and
// "apache-2.0" is not shadowed by a shorter neighbour.
const PROSE_KEYS = Object.keys(SPDX)
  .filter((k) => !NOT_IN_PROSE.has(k))
  .sort((a, b) => b.length - a.length);
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

/**
 * Patterns from the opening of the license texts themselves, most specific
 * first — "Attribution-NonCommercial-ShareAlike 4.0" has to be tried before
 * "Attribution-ShareAlike 4.0" or the NC clause is silently dropped.
 */
const TEXT_PATTERNS: [RegExp, string][] = [
  [/sil open font license,?\s*version 1\.1/i, "OFL-1.1"],
  [/sil open font license,?\s*version 1\.0/i, "OFL-1.0"],
  [/attribution[\s-]*noncommercial[\s-]*noderivat\w*[\s-]*4\.0/i, "CC-BY-NC-ND-4.0"],
  [/attribution[\s-]*noncommercial[\s-]*sharealike[\s-]*4\.0/i, "CC-BY-NC-SA-4.0"],
  [/attribution[\s-]*noncommercial[\s-]*sharealike[\s-]*3\.0/i, "CC-BY-NC-SA-3.0"],
  [/attribution[\s-]*noncommercial[\s-]*4\.0/i, "CC-BY-NC-4.0"],
  [/attribution[\s-]*noderivat\w*[\s-]*4\.0/i, "CC-BY-ND-4.0"],
  [/attribution[\s-]*sharealike[\s-]*4\.0/i, "CC-BY-SA-4.0"],
  [/attribution[\s-]*sharealike[\s-]*3\.0/i, "CC-BY-SA-3.0"],
  [/attribution[\s-]*4\.0 international/i, "CC-BY-4.0"],
  [/attribution[\s-]*3\.0 unported/i, "CC-BY-3.0"],
  [/cc0 1\.0 universal/i, "CC0-1.0"],
  [/open data commons open database license/i, "ODbL-1.0"],
  [/open data commons attribution license/i, "ODC-By-1.0"],
  [/apache license,?\s*version 2\.0/i, "Apache-2.0"],
  [/mozilla public license,?\s*version 2\.0/i, "MPL-2.0"],
  [/eclipse public license\s*-?\s*v?\s*2\.0/i, "EPL-2.0"],
  [/gnu affero general public license,?\s*version 3/i, "AGPL-3.0"],
  [/gnu lesser general public license,?\s*version 3/i, "LGPL-3.0"],
  [/gnu lesser general public license,?\s*version 2\.1/i, "LGPL-2.1"],
  [/gnu general public license,?\s*version 3/i, "GPL-3.0"],
  [/gnu general public license,?\s*version 2/i, "GPL-2.0"],
  [/this is free and unencumbered software released into the public domain/i, "Unlicense"],
  [/boost software license\s*-?\s*version 1\.0/i, "BSL-1.0"],
  [/do what the fuck you want to public license/i, "WTFPL"],
  [/permission is hereby granted, free of charge/i, "MIT"],
  [/neither the name of[\s\S]{0,120}endorse or promote products/i, "BSD-3-Clause"],
  [/redistributions in binary form must reproduce/i, "BSD-2-Clause"],
];

/**
 * Identify a license from the full text of a LICENSE file.
 *
 * GitHub returns `NOASSERTION` whenever its own detector can't classify the
 * file — which it does for every renamed or lightly-edited copy, including
 * OFL fonts (`OFL.txt`) and CC-licensed corpora. Those repos have a perfectly
 * clear license; only the machine reading failed. Same closed-list rule as
 * the rest of this module: no match means "", never a guess.
 */
export function licenseFromText(text: string | null | undefined): string {
  if (!text) return "";
  for (const [re, spdx] of TEXT_PATTERNS) {
    if (re.test(text)) return spdx;
  }
  return "";
}
