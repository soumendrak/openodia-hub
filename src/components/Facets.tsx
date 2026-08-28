import { X } from "lucide-react";
import type { ActiveFilter, FacetOption } from "../lib/facets";

/**
 * Faceted filtering shared by /tools, /models and /datasets.
 *
 * Facets are multi-select with live counts, and every active selection gets a
 * removable chip — the two things NN/g finds catalog users need in order to
 * back out of a filter combination that returned nothing.
 */

export function Chip({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-neon bg-neon/10 text-neon"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * One facet's options. `selected` is a set so the facet is multi-select;
 * clicking a selected option removes it.
 */
export function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  limit = 12,
}: {
  title: string;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  /** Options beyond this are hidden behind a disclosure — long tails bury the useful facets. */
  limit?: number;
}) {
  if (options.length === 0) return null;
  const head = options.slice(0, limit);
  const tail = options.slice(limit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
      {head.map((o) => (
        <Chip key={o.value} active={selected.has(o.value)} onClick={() => onToggle(o.value)}>
          {o.label} ({o.count})
        </Chip>
      ))}
      {tail.length > 0 && (
        <details className="inline">
          <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground [&::-webkit-details-marker]:hidden">
            +{tail.length} more
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {tail.map((o) => (
              <Chip key={o.value} active={selected.has(o.value)} onClick={() => onToggle(o.value)}>
                {o.label} ({o.count})
              </Chip>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ActiveFilterBar({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Filtering by
      </span>
      {filters.map((f) => (
        <button
          key={`${f.facet}:${f.value}`}
          type="button"
          onClick={() => onRemove(f)}
          className="inline-flex items-center gap-1 rounded-full border border-neon bg-neon/10 px-3 py-1.5 text-xs text-neon transition hover:bg-neon/20"
          aria-label={`Remove filter ${f.label}`}
        >
          {f.label}
          <X size={12} />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2 py-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}

/**
 * Zero-result state that names the way out, rather than showing a blank grid.
 * `aria-live` so the count change reaches screen readers.
 */
export function EmptyResults({
  query,
  filters,
  onClearAll,
  noun,
}: {
  query: string;
  filters: ActiveFilter[];
  onClearAll: () => void;
  noun: string;
}) {
  const parts = [query && `"${query}"`, ...filters.map((f) => f.label)].filter(Boolean);
  return (
    <div className="col-span-full rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-muted-foreground">
        No {noun} match {parts.length > 0 ? parts.join(" + ") : "the current filters"}.
      </p>
      {(filters.length > 0 || query) && (
        <button
          type="button"
          onClick={onClearAll}
          className="mt-4 rounded-full border border-neon/40 bg-neon/5 px-5 py-2.5 text-sm font-medium text-neon transition hover:border-neon hover:bg-neon/15"
        >
          Clear {filters.length > 0 ? "filters" : "search"}
        </button>
      )}
    </div>
  );
}

/** Live-announced result count. */
export function ResultCount({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  return (
    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
      Showing {shown} of {total} {noun}
    </p>
  );
}
