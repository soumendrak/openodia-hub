import { X } from "lucide-react";
import type { ActiveFilter, FacetOption } from "../lib/facets";

/**
 * Faceted filtering shared by the catalog pages.
 *
 * Counts are cross-filtered upstream (see lib/facets), so a number here is
 * always what selecting it returns. That leaves one thing for this layer to
 * express: an option that the current combination has put out of reach.
 *
 * Three states, three border treatments — solid, filled, dashed:
 *   available  solid border, hover lifts it
 *   selected   filled neon
 *   out of reach  dashed border, dimmed, inert
 *
 * Dashed reads as "exists in the data, not in this combination" without
 * shouting. Hiding them instead would make the row jump every time a filter
 * changes and hide the shape of the data; leaving them clickable is what the
 * lying counts did.
 */

export function Chip({
  children,
  active,
  onClick,
  ariaLabel,
  disabled,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  /** No results in the current combination — present, but not a choice. */
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={`rounded-full border px-3 py-1.5 text-xs transition duration-200 ${
        active
          ? "border-neon bg-neon/10 text-neon"
          : disabled
            ? "cursor-not-allowed border-dashed border-border/60 text-muted-foreground/40"
            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The count, set in tabular figures so a chip doesn't change width — and the
 * row doesn't reflow — when 44 becomes 8.
 */
function Count({ n }: { n: number }) {
  return <span className="font-mono tabular-nums opacity-70">({n})</span>;
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

  // A selected option stays live even at zero — you must always be able to
  // undo the choice that emptied the page.
  const renderChip = (o: FacetOption) => {
    const isSelected = selected.has(o.value);
    const unreachable = o.count === 0 && !isSelected;
    return (
      <Chip
        key={o.value}
        active={isSelected}
        disabled={unreachable}
        title={
          unreachable
            ? `No ${title.toLowerCase()} results left with the current filters`
            : undefined
        }
        onClick={() => onToggle(o.value)}
      >
        {o.label} <Count n={o.count} />
      </Chip>
    );
  };

  const tailReachable = tail.filter((o) => o.count > 0 || selected.has(o.value)).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
      {head.map(renderChip)}
      {tail.length > 0 && (
        <details className="inline">
          <summary className="inline-flex cursor-pointer list-none rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground [&::-webkit-details-marker]:hidden">
            +{tailReachable > 0 ? tailReachable : tail.length} more
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">{tail.map(renderChip)}</div>
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
