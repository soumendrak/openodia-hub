/**
 * Search contracts and ranking shared by the API and route-level browsers.
 *
 * This intentionally is not a generic fuzzy matcher. OpenOdia has a small,
 * curated corpus where an exact title or resource id should always outrank a
 * coincidental character subsequence in a long description.
 */
export type SearchKind =
  | "page"
  | "repository"
  | "tool"
  | "model"
  | "dataset"
  | "paper"
  | "tutorial"
  | "event";

export type SearchDocument = {
  id: string;
  kind: SearchKind;
  title: string;
  summary: string;
  /** Identifiers, authors, categories, task labels, and carefully curated aliases. */
  keywords?: readonly string[];
  /** Preferred OpenOdia destination, when one exists. */
  href?: string;
  /** Original source; clients may expose this as a secondary action. */
  externalHref?: string;
  source: string;
};

export type SearchResult = SearchDocument & { score: number };

export type SearchSourceStatus = {
  source: string;
  status: "ready" | "unavailable";
  count: number;
};

export type SearchResponse = {
  results: SearchResult[];
  partial: boolean;
  sources: SearchSourceStatus[];
  builtAt: string;
};

export type SearchQueryOptions = {
  kinds?: readonly SearchKind[];
  limit?: number;
  perKindLimit?: number;
};

const ODIA_RANGE = "\\u0B00-\\u0B7F";
const NON_WORD = new RegExp(`[^a-z0-9${ODIA_RANGE}]+`, "g");

/**
 * This is deliberately conservative. It makes the names visitors reliably
 * use for the language equivalent without pretending to offer universal
 * transliteration. Romanized-Odia discovery is metadata-driven: source
 * adapters may add verified Latin aliases to `keywords`, while arbitrary
 * Odia text is never guessed into a potentially incorrect transliteration.
 */
const ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/\boriya\b/gi, "odia"],
  [/ଓଡ଼ିଆ/g, "odia"],
  [/ଓଡିଆ/g, "odia"],
  [/ଓରିଆ/g, "odia"],
];

export function normalizeSearch(value: string): string {
  let normalized = value.normalize("NFKC").toLocaleLowerCase("en-US");
  for (const [pattern, replacement] of ALIASES)
    normalized = normalized.replace(pattern, replacement);
  return normalized.replace(NON_WORD, " ").trim().replace(/\s+/g, " ");
}

export function searchTokens(value: string): string[] {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let edits = 0;
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    if (a[ai] === b[bi]) {
      ai++;
      bi++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) ai++;
    else if (b.length > a.length) bi++;
    else {
      ai++;
      bi++;
    }
  }
  return true;
}

type NormalizedField = { value: string; tokens: string[] };
type NormalizedDocument = {
  title: NormalizedField;
  keywords: NormalizedField;
  summary: NormalizedField;
};

const documentIndex = new WeakMap<SearchDocument, NormalizedDocument>();

function normalizedField(value: string): NormalizedField {
  const normalized = normalizeSearch(value);
  return { value: normalized, tokens: normalized.split(" ").filter(Boolean) };
}

function indexedDocument(document: SearchDocument): NormalizedDocument {
  const existing = documentIndex.get(document);
  if (existing) return existing;
  const indexed = {
    title: normalizedField(document.title),
    keywords: normalizedField((document.keywords ?? []).join(" ")),
    summary: normalizedField(document.summary),
  };
  documentIndex.set(document, indexed);
  return indexed;
}

function tokenScore(
  field: NormalizedField,
  query: string,
  queryTokens: readonly string[],
  weight: number,
): number {
  const { value, tokens: fieldTokens } = field;
  if (!value || !query) return 0;
  if (value === query) return 10_000 * weight;
  if (value.startsWith(query)) return 8_000 * weight;
  if (value.includes(query)) return 6_000 * weight;
  if (queryTokens.length > 0 && queryTokens.every((token) => fieldTokens.includes(token))) {
    return 4_000 * weight;
  }

  // Typo tolerance only applies to useful, word-length tokens. It never
  // accepts an arbitrary subsequence such as "od ai" for an unrelated item.
  if (
    queryTokens.length > 0 &&
    queryTokens.every(
      (queryToken) =>
        queryToken.length >= 4 &&
        fieldTokens.some((fieldToken) => editDistanceAtMostOne(queryToken, fieldToken)),
    )
  ) {
    return 1_000 * weight;
  }
  return 0;
}

function scoreIndexedDocument(
  document: SearchDocument,
  query: string,
  queryTokens: readonly string[],
): number {
  if (!query) return 0;
  const indexed = indexedDocument(document);

  // The largest matching field wins: an exact title must not be displaced by
  // many description occurrences. Stable identity is represented in keywords.
  return Math.max(
    tokenScore(indexed.title, query, queryTokens, 4),
    tokenScore(indexed.keywords, query, queryTokens, 2),
    tokenScore(indexed.summary, query, queryTokens, 1),
  );
}

export function scoreSearchDocument(document: SearchDocument, rawQuery: string): number {
  const query = normalizeSearch(rawQuery);
  return scoreIndexedDocument(document, query, query.split(" ").filter(Boolean));
}

export function searchDocuments(
  documents: readonly SearchDocument[],
  query: string,
  options: SearchQueryOptions = {},
): SearchResult[] {
  const allowed = options.kinds ? new Set(options.kinds) : undefined;
  const normalizedQuery = normalizeSearch(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const byIdentity = new Map<string, SearchResult>();
  for (const document of documents) {
    if (allowed && !allowed.has(document.kind)) continue;
    const score = scoreIndexedDocument(document, normalizedQuery, queryTokens);
    if (score === 0) continue;
    const existing = byIdentity.get(document.id);
    const result = { ...document, score };
    if (!existing || score > existing.score) byIdentity.set(document.id, result);
  }
  const ranked = [...byIdentity.values()].sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  if (!options.perKindLimit) return ranked.slice(0, options.limit ?? 50);
  const counts = new Map<SearchKind, number>();
  const diversified = ranked.filter((result) => {
    const count = counts.get(result.kind) ?? 0;
    if (count >= options.perKindLimit!) return false;
    counts.set(result.kind, count + 1);
    return true;
  });
  return diversified.slice(0, options.limit ?? 50);
}
