/**
 * Research-paper index for Odia language technology.
 *
 * Two sources, merged and deduplicated:
 *   - OpenAlex, restricted to works whose title/abstract mentions Odia or
 *     Oriya *and* that OpenAlex classifies under natural language processing.
 *     That second condition is what keeps culinary and literary papers about
 *     Odisha out of an NLP index.
 *   - arXiv cs.CL, which carries preprints before OpenAlex indexes them.
 *
 * Task tags are keyword matches over title and abstract, not claims by the
 * authors — they are a filter, not metadata.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  /** Best public link: DOI, else arXiv, else the landing page. */
  url: string;
  pdfUrl?: string;
  abstract: string;
  openAccess: boolean;
  tasks: string[];
  sources: string[];
};

const OPENALEX =
  "https://api.openalex.org/works?filter=title_and_abstract.search:odia%20OR%20oriya,concepts.id:C204321447&per_page=100&sort=publication_year:desc";
const ARXIV =
  "https://export.arxiv.org/api/query?search_query=abs:%22Odia%22+AND+cat:cs.CL&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending";
const OPENALEX_PAGES = 2;
const TTL_MS = 24 * 60 * 60 * 1000;
// OpenAlex asks for a contact in the User-Agent for its polite pool.
const HEADERS = { "User-Agent": "openodia.com (+https://openodia.com)" };

/** Task keywords, checked against title + abstract. */
const TASK_PATTERNS: [string, RegExp][] = [
  [
    "Translation",
    /\b(machine translation|translat\w*|\bNMT\b|\bSMT\b|parallel corpus|parallel corpora)\b/i,
  ],
  ["Speech recognition", /\b(speech recognition|\bASR\b|acoustic model|speech-to-text)\b/i],
  ["Speech synthesis", /\b(speech synthesis|text-to-speech|\bTTS\b|voice cloning)\b/i],
  ["OCR", /\b(\bOCR\b|optical character recognition|handwrit\w+|document image)\b/i],
  ["NER", /\b(named entity|\bNER\b)\b/i],
  ["POS tagging", /\b(part[- ]of[- ]speech|\bPOS tag\w*|morphological analy\w+)\b/i],
  ["Parsing", /\b(depend\w+ pars\w+|treebank|constituency pars\w+|universal dependenc\w+)\b/i],
  [
    "Sentiment",
    /\b(sentiment|opinion mining|emotion (detection|recognition)|hate speech|offensive)\b/i,
  ],
  ["Summarization", /\b(summari[sz]\w+)\b/i],
  ["Question answering", /\b(question answering|\bQA\b dataset|reading comprehension)\b/i],
  [
    "Language models",
    /\b(language model|\bLLM\b|\bBERT\b|transformer|pre-?train\w+|fine-?tun\w+)\b/i,
  ],
  [
    "Embeddings",
    /\b(word embedding|word2vec|fasttext|sentence embedding|representation learning)\b/i,
  ],
  ["Corpora & resources", /\b(corpus|corpora|dataset|lexicon|wordnet|annotat\w+|resource)\b/i],
  ["Transliteration", /\b(translitera\w+|romani[sz]ation|script conversion)\b/i],
  [
    "Classification",
    /\b(text classification|document classification|topic (model|classification))\b/i,
  ],
];

export function taskTags(text: string): string[] {
  return TASK_PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

/** Titles vary in punctuation and case across sources; compare on the letters. */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** OpenAlex ships abstracts as an inverted index to sidestep copyright. */
function deInvertAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const p of positions) words[p] = word;
  }
  return words.filter(Boolean).join(" ").slice(0, 600);
}

type OpenAlexWork = {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: {
    source?: { display_name?: string } | null;
    landing_page_url?: string | null;
  };
  open_access?: { is_oa?: boolean; oa_url?: string | null };
};

async function fetchOpenAlex(): Promise<Paper[]> {
  const papers: Paper[] = [];
  for (let page = 1; page <= OPENALEX_PAGES; page++) {
    const r = await fetchWithTimeout(`${OPENALEX}&page=${page}`, { headers: HEADERS }, 20000);
    if (!r.ok) throw new UpstreamUnavailableError(`openalex_${r.status}`);
    const body = (await r.json()) as { results?: OpenAlexWork[] };
    const results = body.results ?? [];
    if (results.length === 0) break;

    for (const w of results) {
      const title = (w.title ?? w.display_name ?? "").trim();
      if (!title) continue;
      const abstract = deInvertAbstract(w.abstract_inverted_index);
      papers.push({
        id: w.doi ?? w.id,
        title,
        authors: (w.authorships ?? [])
          .map((a) => a.author?.display_name ?? "")
          .filter(Boolean)
          .slice(0, 8),
        year: w.publication_year ?? null,
        venue: w.primary_location?.source?.display_name ?? "",
        url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
        pdfUrl: w.open_access?.oa_url ?? undefined,
        abstract,
        openAccess: w.open_access?.is_oa === true,
        tasks: taskTags(`${title} ${abstract}`),
        sources: ["openalex"],
      });
    }
  }
  return papers;
}

function xmlText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

async function fetchArxiv(): Promise<Paper[]> {
  const r = await fetchWithTimeout(ARXIV, { headers: HEADERS }, 20000);
  if (!r.ok) throw new UpstreamUnavailableError(`arxiv_${r.status}`);
  const xml = await r.text();

  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).flatMap((entry) => {
    const title = xmlText(entry, "title");
    if (!title) return [];
    const abstract = xmlText(entry, "summary").slice(0, 600);
    const id = xmlText(entry, "id");
    const published = xmlText(entry, "published");
    const pdf = /<link[^>]+title="pdf"[^>]+href="([^"]+)"/.exec(entry)?.[1];
    return [
      {
        id,
        title,
        authors: [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]).slice(0, 8),
        year: published ? Number(published.slice(0, 4)) : null,
        venue: "arXiv",
        url: id,
        pdfUrl: pdf,
        abstract,
        openAccess: true,
        tasks: taskTags(`${title} ${abstract}`),
        sources: ["arxiv"],
      },
    ];
  });
}

/** OpenAlex carries duplicate records for some works, and arXiv overlaps it. */
function dedupe(papers: Paper[]): Paper[] {
  const byKey = new Map<string, Paper>();
  for (const p of papers) {
    const key = titleKey(p.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
      continue;
    }
    byKey.set(key, {
      ...existing,
      // Prefer whichever record has more of what a reader needs.
      abstract: existing.abstract.length >= p.abstract.length ? existing.abstract : p.abstract,
      venue: existing.venue && existing.venue !== "arXiv" ? existing.venue : p.venue,
      pdfUrl: existing.pdfUrl ?? p.pdfUrl,
      openAccess: existing.openAccess || p.openAccess,
      tasks: [...new Set([...existing.tasks, ...p.tasks])],
      sources: [...new Set([...existing.sources, ...p.sources])],
    });
  }
  return [...byKey.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export async function loadPapers(): Promise<Paper[]> {
  return cachedJson("papers", TTL_MS, async () => {
    const [openalex, arxiv] = await Promise.allSettled([fetchOpenAlex(), fetchArxiv()]);
    if (openalex.status === "rejected") console.error("openalex:", openalex.reason);
    if (arxiv.status === "rejected") console.error("arxiv:", arxiv.reason);

    const all = [
      ...(openalex.status === "fulfilled" ? openalex.value : []),
      ...(arxiv.status === "fulfilled" ? arxiv.value : []),
    ];
    if (all.length === 0) throw new UpstreamUnavailableError("no_paper_source_available");
    return dedupe(all);
  });
}
