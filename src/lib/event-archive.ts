export type EventArchiveSearch = { q?: string; year?: string; sort?: "oldest" };
export function parseEventArchiveSearch(search: Record<string, unknown>): EventArchiveSearch {
  const year = typeof search.year === "number" ? String(search.year) : search.year;
  return {
    ...(typeof search.q === "string" && search.q.length <= 80 ? { q: search.q } : {}),
    ...(typeof year === "string" && /^\d{4}$/.test(year) ? { year } : {}),
    ...(search.sort === "oldest" ? { sort: "oldest" as const } : {}),
  };
}
