/**
 * Facet counting for the three directory pages.
 *
 * Counts come from the currently loaded list, so a facet's number is always
 * "how many results this option would leave", not a static claim.
 */

export type FacetOption = { value: string; label: string; count: number };

export type ActiveFilter = { facet: string; value: string; label: string };

export function buildFacet<T>(
  items: T[],
  key: (item: T) => string,
  label: (value: string) => string = (v) => v,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: label(value), count }));
}

/** Immutable toggle for a multi-select facet's selection set. */
export function toggleValue(selected: Set<string>, value: string): Set<string> {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
