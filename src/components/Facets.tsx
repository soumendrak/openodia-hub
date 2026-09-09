import { Check, ChevronDown, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
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
  const [open, setOpen] = useState(false);
  const [facetQuery, setFacetQuery] = useState("");
  const searchId = useId();

  if (options.length === 0) return null;
  const head = options.slice(0, limit);
  const tail = options.slice(limit);

  const selectedTail = tail.filter((o) => selected.has(o.value));
  const query = facetQuery.trim().toLowerCase();
  const matchingOptions = query
    ? options.filter((o) => o.label.toLowerCase().includes(query))
    : [...head, ...selectedTail];
  const visibleOptions = matchingOptions.filter(
    (option, index, all) =>
      all.findIndex((candidate) => candidate.value === option.value) === index,
  );
  const hiddenCount = options.length - visibleOptions.length;
  const hasSearch = options.length > limit;
  const selectedCount = selected.size;

  const optionButton = (o: FacetOption) => {
    const isSelected = selected.has(o.value);
    const unreachable = o.count === 0 && !isSelected;
    return (
      <button
        key={o.value}
        type="button"
        onClick={() => onToggle(o.value)}
        disabled={unreachable}
        aria-pressed={isSelected}
        aria-label={`${o.label} (${o.count})`}
        className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
          isSelected
            ? "bg-neon/10 text-neon"
            : unreachable
              ? "cursor-not-allowed text-muted-foreground/40"
              : "text-foreground hover:bg-surface-2"
        }`}
      >
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
            isSelected ? "border-neon bg-neon text-background" : "border-border"
          }`}
        >
          {isSelected && <Check size={11} strokeWidth={3} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
        <Count n={o.count} />
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setFacetQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors ${
            open || selectedCount > 0
              ? "border-neon/60 bg-neon/10 text-neon"
              : "border-border bg-surface/60 text-muted-foreground hover:border-foreground/40 hover:bg-surface hover:text-foreground"
          }`}
          aria-label={`Filter by ${title}`}
        >
          <span>{title}</span>
          <span className="font-mono text-xs tabular-nums opacity-70">
            {selectedCount > 0 ? `${selectedCount} selected` : `${options.length} options`}
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-border bg-surface p-3 text-foreground shadow-2xl shadow-black/20"
      >
        <div className="flex items-start justify-between gap-4 px-1 pb-2">
          <div>
            <p className="text-sm font-medium">Filter by {title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} selected` : "Select one or more"}
            </p>
          </div>
          {selectedCount > 0 && (
            <span className="rounded-full bg-neon/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-neon">
              Active
            </span>
          )}
        </div>

        {hasSearch && (
          <div className="relative mb-2">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor={searchId} className="sr-only">
              Search {title.toLowerCase()} filters
            </label>
            <input
              id={searchId}
              value={facetQuery}
              onChange={(event) => setFacetQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="h-10 w-full rounded-xl border border-border bg-background/50 pl-9 pr-3 text-sm outline-none transition focus:border-neon"
            />
          </div>
        )}

        {visibleOptions.length > 0 ? (
          <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {visibleOptions.map(optionButton)}
          </div>
        ) : (
          <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} filters match “{facetQuery}”.
          </p>
        )}

        {hiddenCount > 0 && !query && (
          <p className="px-2.5 pt-2 text-[11px] text-muted-foreground">
            Showing the top {visibleOptions.length} of {options.length}. Search to find more.
          </p>
        )}
      </PopoverContent>
    </Popover>
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
