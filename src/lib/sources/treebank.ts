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

function tokenMatches(token: Token, query: TreebankQuery, needle: string): boolean {
  if (query.upos && token.upos !== query.upos) return false;
  if (query.deprel && token.deprel !== query.deprel) return false;
  if (!needle) return true;
  return (
    token.form.toLowerCase().includes(needle) ||
    token.translit.toLowerCase().includes(needle) ||
    token.feats.toLowerCase().includes(needle)
  );
}

export function searchTreebank(corpus: Treebank, query: TreebankQuery): TreebankResult {
  const needle = query.q.trim().toLowerCase();
  const hasCriteria = Boolean(needle || query.upos || query.deprel);

  const uposCounts = new Map<string, number>();
  const deprelCounts = new Map<string, number>();
  for (const s of corpus.sentences) {
    for (const t of s.tokens) {
      if (t.upos !== "PUNCT") uposCounts.set(t.upos, (uposCounts.get(t.upos) ?? 0) + 1);
      if (t.deprel !== "punct") deprelCounts.set(t.deprel, (deprelCounts.get(t.deprel) ?? 0) + 1);
    }
  }

  const hits: Concordance[] = [];
  let total = 0;
  for (const sentence of corpus.sentences) {
    const matches: number[] = [];
    sentence.tokens.forEach((token, i) => {
      if (tokenMatches(token, query, needle)) matches.push(i);
    });
    // With no criteria every token "matches"; show the sentence, highlight none.
    if (matches.length === 0) continue;
    total++;
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
