import type { Event } from "../data/events";

const TYPES = ["Conference", "Summit", "Workshop", "Research", "Hackathon", "Talk"];
export type EventArchiveSearch = {
  q?: string;
  year?: string;
  sort?: "oldest";
  community?: string;
  type?: Event["type"];
};
export function parseEventArchiveSearch(search: Record<string, unknown>): EventArchiveSearch {
  const year = typeof search.year === "number" ? String(search.year) : search.year;
  return {
    ...(typeof search.q === "string" && search.q.length <= 80 ? { q: search.q } : {}),
    ...(typeof year === "string" && /^\d{4}$/.test(year) ? { year } : {}),
    ...(typeof search.community === "string" && search.community.length <= 80
      ? { community: search.community }
      : {}),
    ...(typeof search.type === "string" && TYPES.includes(search.type)
      ? { type: search.type as Event["type"] }
      : {}),
    ...(search.sort === "oldest" ? { sort: "oldest" as const } : {}),
  };
}
