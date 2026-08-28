import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Heart, Download, ChevronDown, Database } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { FeaturedGallery, formatCount } from "../components/FeaturedGallery";
import { ActiveFilterBar, EmptyResults, FacetGroup, ResultCount } from "../components/Facets";
import { ResourceMeta } from "../components/ResourceMeta";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import {
  computeFacets,
  toggleSelection,
  type ActiveFilter,
  type FacetDef,
  type Selection,
} from "../lib/facets";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import { prettySize, sizeRank } from "../lib/dataset-size";
import { normalizeSpdx } from "../lib/license";
import { refToPath } from "../lib/resource-id";
import { MIN_LIKES, pickWeeklyBy } from "../lib/weekly-picks";
import { loadDatasets, type Dataset } from "../lib/sources/huggingface";

/**
 * Runs on the server during SSR and over RPC on client navigation, so the
 * browser is in the server HTML instead of arriving after hydration.
 */
const getDatasets = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const page = await loadDatasets();
    return { datasets: page.items, truncated: page.truncated, failed: false };
  } catch (e) {
    console.error("datasets loader:", e);
    return { datasets: [] as Dataset[], truncated: false, failed: true };
  }
});

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [
      { title: "Datasets · OpenOdia" },
      {
        name: "description",
        content:
          "Live browser of Odia-language datasets on Hugging Face — parallel corpora, speech, classification, instruction-tuning — with size, license, and citations.",
      },
      { property: "og:title", content: "Datasets · OpenOdia" },
      {
        property: "og:description",
        content: "Live browser of Odia-language datasets on Hugging Face.",
      },
    ],
  }),
  loader: () => getDatasets(),
  staleTime: 60 * 60 * 1000,
  component: DatasetsPage,
});

function prettyTask(t: string): string {
  if (t === "other") return "Other";
  return t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE = 30;

const FACETS: FacetDef<Dataset>[] = [
  { key: "task", title: "Task", values: (d) => [d.task], label: prettyTask },
  {
    key: "size",
    title: "Size",
    values: (d) => [d.sizeCategory],
    label: prettySize,
    order: (a, b) => sizeRank(a.value) - sizeRank(b.value),
  },
  { key: "license", title: "License", values: (d) => [normalizeSpdx(d.license)] },
];

function DatasetsPage() {
  const { datasets, truncated, failed } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Selection>({});
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const resetPage = () => setShownCount(PAGE_SIZE);

  const toggle = (facet: string) => (value: string) => {
    setSelected((prev) => toggleSelection(prev, facet, value));
    resetPage();
  };

  const clearAll = () => {
    setSelected({});
    setQ("");
    resetPage();
  };

  const removeFilter = (f: ActiveFilter) => toggle(f.facet)(f.value);

  // Five datasets featured above the browser, drawn from a seeded shuffle keyed
  // on the ISO week — same set for every visitor all week, rotates itself every
  // Monday. Deterministic, so SSR and the client agree. See lib/weekly-picks.
  const featured = useMemo(() => {
    const { hero, reels } = pickWeeklyBy(datasets, new Date(), (d) => d.likes, MIN_LIKES);
    const toItem = (d: Dataset) => ({ ...d, label: prettyTask(d.task) });
    return { hero: hero.map(toItem), reels: reels.map(toItem) };
  }, [datasets]);

  // Cross-filtered counts: each facet is counted against the *other* facets'
  // selections, so "Translation (12)" always yields 12.
  const {
    filtered,
    options,
    active: activeFilters,
  } = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const search = (d: Dataset) =>
      !lq ||
      d.id.toLowerCase().includes(lq) ||
      d.author.toLowerCase().includes(lq) ||
      d.task.toLowerCase().includes(lq) ||
      d.description.toLowerCase().includes(lq) ||
      d.tags.some((t) => t.toLowerCase().includes(lq));
    return computeFacets(datasets, FACETS, selected, search);
  }, [datasets, q, selected]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Datasets", url: "https://openodia.com/datasets" },
        ])}
      />
      {datasets.length > 0 && (
        <JsonLd
          data={itemListSchema(
            datasets.slice(0, 50).map((d) => ({
              name: d.id,
              url: d.url,
              description: d.description || prettyTask(d.task),
            })),
            "Odia Datasets",
            "Live browser of Odia-language datasets on Hugging Face.",
          )}
        />
      )}

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Browser</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia <span className="text-gradient">datasets</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Live from Hugging Face — every dataset tagged for Odia. Parallel corpora, speech,
          classification, instruction-tuning, each with its size, license, and a citation.
        </p>
      </Reveal>

      {failed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          Hugging Face is unreachable right now, so the browser is empty below. Reload in a minute.
        </p>
      )}

      {featured.hero.length > 0 && (
        <Reveal delay={0.05} className="mt-12">
          <FeaturedGallery hero={featured.hero} reels={featured.reels} />
        </Reveal>
      )}

      <Reveal delay={0.1} className="mt-10">
        <div className="relative max-w-xl">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="Search datasets, authors, tags… [/]"
            className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
          />
        </div>

        <div className="mt-5 space-y-3">
          {FACETS.map((f) => (
            <FacetGroup
              key={f.key}
              title={f.title}
              options={options[f.key]}
              selected={selected[f.key] ?? new Set()}
              onToggle={toggle(f.key)}
            />
          ))}
        </div>

        <ActiveFilterBar filters={activeFilters} onRemove={removeFilter} onClearAll={clearAll} />
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <EmptyResults query={q} filters={activeFilters} onClearAll={clearAll} noun="datasets" />
        ) : (
          filtered.slice(0, shownCount).map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: Math.min(i, 12) * 0.02,
              }}
              className="group flex h-full min-w-0 flex-col rounded-2xl border border-border bg-surface transition hover:border-neon/40"
            >
              <Link
                to={refToPath({ kind: "dataset", id: d.id })}
                className="flex flex-1 flex-col p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {prettyTask(d.task)}
                  </span>
                  <ExternalLink
                    size={14}
                    className="text-muted-foreground transition group-hover:text-neon"
                  />
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{d.name}</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">@{d.author}</p>
                {d.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{d.description}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-muted-foreground">
                  {d.sizeCategory && (
                    <span
                      className="inline-flex items-center gap-1"
                      title="Rows, per the dataset's size_categories tag"
                    >
                      <Database size={12} /> {prettySize(d.sizeCategory)} rows
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Download size={12} /> {formatCount(d.downloads)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart size={12} /> {formatCount(d.likes)}
                  </span>
                </div>
              </Link>
              <ResourceMeta
                license={normalizeSpdx(d.license)}
                entry={{ name: d.name, author: d.author, url: d.url, createdAt: d.createdAt }}
                extra={d.modalities.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              />
            </motion.div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <ResultCount
            shown={Math.min(shownCount, filtered.length)}
            total={filtered.length}
            noun="datasets"
          />
          {truncated && (
            <p className="text-[11px] text-muted-foreground">
              Hugging Face has more Odia-tagged datasets than this page loads; the browser stops at
              the first {datasets.length}.
            </p>
          )}
          {filtered.length > shownCount && (
            <button
              onClick={() => setShownCount((n) => n + PAGE_SIZE)}
              className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/5 px-5 py-2.5 text-sm font-medium text-neon transition hover:border-neon hover:bg-neon/15"
            >
              Load more <ChevronDown size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
