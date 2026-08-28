/**
 * Faceted filtering for the catalog pages.
 *
 * The rule that matters: **a facet's count is what selecting it would actually
 * return.** Counting over the whole list instead makes the numbers lie as soon
 * as a first filter is applied — "Translation (44)" next to an active
 * `MIT` filter, which then yields nothing.
 *
 * So each facet is counted over the items matching every *other* active facet,
 * but not its own selection. Selecting inside one facet is OR (picking MIT
 * shouldn't hide Apache-2.0 next to it); across facets it is AND. This is the
 * standard disjunctive-faceting model, and it makes the invariant hold: an
 * option showing (n) with n > 0 always returns n results — and where that
 * facet already has a value selected, adding another widens the OR, so the
 * total grows past n. Either way a positive count never leads to a blank page,
 * and a zero count is rendered inert rather than clickable.
 */

export type FacetOption = { value: string; label: string; count: number };

export type ActiveFilter = { facet: string; value: string; label: string };

export type FacetDef<T> = {
  /** Stable id, used as the key in the selection map and on ActiveFilter. */
  key: string;
  title: string;
  /** The facet values an item belongs to. Several for multi-valued facets. */
  values: (item: T) => readonly string[];
  label?: (value: string) => string;
  /** Overrides the default count-desc ordering — for size buckets, eras, etc. */
  order?: (a: FacetOption, b: FacetOption) => number;
};

export type Selection = Record<string, Set<string>>;

const NONE: Set<string> = new Set();

function selectionFor(selected: Selection, key: string): Set<string> {
  return selected[key] ?? NONE;
}

function matches<T>(item: T, def: FacetDef<T>, selection: Set<string>): boolean {
  if (selection.size === 0) return true;
  for (const value of def.values(item)) if (selection.has(value)) return true;
  return false;
}

/** Count desc, then zeros last, then alphabetical — stable across renders. */
function byCount(a: FacetOption, b: FacetOption): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

export type FacetResult<T> = {
  /** Items matching the search and every facet. */
  filtered: T[];
  /** Cross-filtered options, keyed by facet id. */
  options: Record<string, FacetOption[]>;
  /** Removable chips for everything currently selected. */
  active: ActiveFilter[];
};

/**
 * @param items every loaded item
 * @param defs the facets, in display order
 * @param selected facet id → chosen values
 * @param search free-text predicate, applied before every count
 */
export function computeFacets<T>(
  items: readonly T[],
  defs: readonly FacetDef<T>[],
  selected: Selection,
  search: (item: T) => boolean = () => true,
): FacetResult<T> {
  // The search narrows the vocabulary itself — a facet value with no match
  // left after searching is noise, not a choice the user backed out of.
  const base = items.filter(search);

  const filtered = base.filter((item) =>
    defs.every((def) => matches(item, def, selectionFor(selected, def.key))),
  );

  const options: Record<string, FacetOption[]> = {};

  for (const def of defs) {
    const others = defs.filter((d) => d.key !== def.key);
    const counts = new Map<string, number>();

    // Seed every value present in `base` at zero, so options don't vanish and
    // reappear as filters change — they go quiet and come back.
    for (const item of base) {
      for (const value of def.values(item)) if (value) counts.set(value, 0);
    }

    for (const item of base) {
      if (!others.every((d) => matches(item, d, selectionFor(selected, d.key)))) continue;
      for (const value of def.values(item)) {
        // Seeded to 0 in the pass above, so the key is always already there.
        if (value) counts.set(value, counts.get(value)! + 1);
      }
    }

    const list = [...counts.entries()].map(([value, count]) => ({
      value,
      label: def.label ? def.label(value) : value,
      count,
    }));
    // A custom order still puts unreachable options last; they are not choices.
    options[def.key] = def.order
      ? list.sort((a, b) =>
          (a.count === 0) === (b.count === 0) ? def.order!(a, b) : a.count === 0 ? 1 : -1,
        )
      : list.sort(byCount);
  }

  const active: ActiveFilter[] = defs.flatMap((def) =>
    [...selectionFor(selected, def.key)].map((value) => ({
      facet: def.key,
      value,
      label: def.label ? def.label(value) : value,
    })),
  );

  return { filtered, options, active };
}

/** Immutable toggle for a multi-select facet's selection set. */
export function toggleValue(selected: Set<string>, value: string): Set<string> {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Toggles one value inside a whole selection map. */
export function toggleSelection(selected: Selection, facet: string, value: string): Selection {
  return { ...selected, [facet]: toggleValue(selectionFor(selected, facet), value) };
}

export function hasSelection(selected: Selection): boolean {
  return Object.values(selected).some((s) => s.size > 0);
}
