/**
 * UD_Odia-ODTB — the Odia Universal Dependencies treebank.
 *
 * The treebank is published as a CoNLL-U file on GitHub and has no public
 * search interface anywhere, so reading it means downloading 700 KB and
 * writing a parser. This does that once, server-side, and searches it there:
 * the corpus never goes over the wire to the browser, only the matches.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export const TREEBANK = {
  name: "UD_Odia-ODTB",
  repo: "https://github.com/UniversalDependencies/UD_Odia-ODTB",
  file: "or_odtb-ud-test.conllu",
  url: "https://raw.githubusercontent.com/UniversalDependencies/UD_Odia-ODTB/dev/or_odtb-ud-test.conllu",
  license: "CC-BY-SA-4.0",
};

export type Token = {
  id: number;
  form: string;
  upos: string;
  xpos: string;
  feats: string;
  head: number;
  deprel: string;
  translit: string;
};

export type Sentence = {
  sentId: string;
  text: string;
  translit: string;
  textEn: string;
  tokens: Token[];
};

export type Treebank = {
  sentences: Sentence[];
  tokenCount: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;

/** MISC is a `|`-separated key=value list; Translit is the field we surface. */
function misc(field: string, key: string): string {
  for (const part of field.split("|")) {
    if (part.startsWith(`${key}=`)) return part.slice(key.length + 1);
  }
  return "";
}

export function parseConllu(text: string): Treebank {
  const sentences: Sentence[] = [];
  let current: Sentence | null = null;
  let tokenCount = 0;

  const flush = () => {
    if (current && current.tokens.length > 0) sentences.push(current);
    current = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");

    if (line.trim() === "") {
      flush();
      continue;
    }

    if (line.startsWith("#")) {
      const m = /^#\s*([a-z_]+)\s*=\s*(.*)$/i.exec(line);
      if (!m) continue;
      current ??= { sentId: "", text: "", translit: "", textEn: "", tokens: [] };
      const [, key, value] = m;
      if (key === "sent_id") current.sentId = value.trim();
      else if (key === "text") current.text = value.trim();
      else if (key === "translit") current.translit = value.trim();
      else if (key === "text_en") current.textEn = value.trim();
      continue;
    }

    const cols = line.split("\t");
    if (cols.length < 10) continue;
    // Multiword ranges ("1-2") and empty nodes ("1.1") are not tokens.
    if (!/^\d+$/.test(cols[0])) continue;

    current ??= { sentId: "", text: "", translit: "", textEn: "", tokens: [] };
    current.tokens.push({
      id: Number(cols[0]),
      form: cols[1],
      upos: cols[3],
      xpos: cols[4],
      feats: cols[5] === "_" ? "" : cols[5],
      head: Number(cols[6]) || 0,
      deprel: cols[7],
      translit: misc(cols[9], "Translit"),
    });
    tokenCount++;
  }
  flush();

  return { sentences, tokenCount };
}

export async function loadTreebank(): Promise<Treebank> {
  return cachedJson("treebank-odtb", TTL_MS, async () => {
    const r = await fetchWithTimeout(
      TREEBANK.url,
      { headers: { "User-Agent": "openodia.com" } },
      20000,
    );
    if (!r.ok) throw new UpstreamUnavailableError(`treebank_${r.status}`);
    const parsed = parseConllu(await r.text());
    if (parsed.sentences.length === 0) throw new UpstreamUnavailableError("treebank_empty");
    return parsed;
  });
}

export type TreebankQuery = {
  /** Matches a token's form or its transliteration; empty matches everything. */
  q: string;
  upos: string;
  deprel: string;
  limit: number;
};

export type Concordance = {
  sentence: Sentence;
  /** Indexes into `sentence.tokens` that matched — the keyword in KWIC. */
  matches: number[];
};

export type TreebankResult = {
  hits: Concordance[];
  total: number;
  uposCounts: [string, number][];
  deprelCounts: [string, number][];
  sentenceCount: number;
  tokenCount: number;
};

export function searchTreebank(corpus: Treebank, query: TreebankQuery): TreebankResult {
  const needle = query.q.trim().toLowerCase();
  const hasCriteria = Boolean(needle || query.upos || query.deprel);

  const textMatches = (t: Token) =>
    !needle ||
    t.form.toLowerCase().includes(needle) ||
    t.translit.toLowerCase().includes(needle) ||
    t.feats.toLowerCase().includes(needle);

  // Counts are cross-filtered and counted in *sentences*, the unit the results
  // are in: the part-of-speech numbers are computed with the relation filter
  // applied and vice versa, so picking an option always leaves that many
  // sentences rather than a number that turns out to be zero.
  const uposCounts = new Map<string, number>();
  const deprelCounts = new Map<string, number>();

  const hits: Concordance[] = [];
  let total = 0;

  for (const sentence of corpus.sentences) {
    const matches: number[] = [];
    const uposHere = new Set<string>();
    const deprelHere = new Set<string>();

    sentence.tokens.forEach((token, i) => {
      if (!textMatches(token)) return;
      const uposOk = !query.upos || token.upos === query.upos;
      const deprelOk = !query.deprel || token.deprel === query.deprel;

      if (uposOk && deprelOk) matches.push(i);
      // For the part-of-speech facet, hold its own selection out.
      if (deprelOk && token.upos !== "PUNCT") uposHere.add(token.upos);
      if (uposOk && token.deprel !== "punct") deprelHere.add(token.deprel);
    });

    for (const v of uposHere) uposCounts.set(v, (uposCounts.get(v) ?? 0) + 1);
    for (const v of deprelHere) deprelCounts.set(v, (deprelCounts.get(v) ?? 0) + 1);

    if (matches.length === 0) continue;
    total++;
    // With no criteria every token "matches"; show the sentence, highlight none.
    if (hits.length < query.limit) {
      hits.push({ sentence, matches: hasCriteria ? matches : [] });
    }
  }

  const bySize = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0]);
  return {
    hits,
    total,
    uposCounts: [...uposCounts.entries()].sort(bySize),
    deprelCounts: [...deprelCounts.entries()].sort(bySize).slice(0, 20),
    sentenceCount: corpus.sentences.length,
    tokenCount: corpus.tokenCount,
  };
}
