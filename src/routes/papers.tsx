import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Search } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { ActiveFilterBar, EmptyResults, FacetGroup, ResultCount } from "../components/Facets";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import {
  computeFacets,
  toggleSelection,
  type ActiveFilter,
  type FacetDef,
  type Selection,
} from "../lib/facets";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { loadPapers, type Paper } from "../lib/sources/papers";
import { pageHead } from "../lib/seo";

const getPapers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { papers: await loadPapers(), failed: false };
  } catch (e) {
    console.error("papers loader:", e);
    return { papers: [] as Paper[], failed: true };
  }
});

export const Route = createFileRoute("/papers")({
  head: () =>
    pageHead({
      path: "papers",
      title: "Papers · OpenOdia",
      description:
        "Research index for Odia language technology — translation, speech, OCR, parsing, and corpora — from OpenAlex and arXiv, filterable by task and year.",
      ogDescription: "Research papers on Odia NLP, indexed by task and year.",
    }),
  loader: () => getPapers(),
  staleTime: 24 * 60 * 60 * 1000,
  component: PapersPage,
});

const PAGE_SIZE = 25;

/** Group years into eras so the facet stays scannable. */
function yearBucket(year: number | null): string {
  if (!year) return "";
  if (year >= 2024) return "2024–now";
  if (year >= 2020) return "2020–2023";
  if (year >= 2015) return "2015–2019";
  return "Before 2015";
}

const BUCKET_ORDER = ["2024–now", "2020–2023", "2015–2019", "Before 2015"];

// A paper carries several task tags, so `values` returns them all: selecting
// two tasks is OR within the facet, and AND against the year facet.
const FACETS: FacetDef<Paper>[] = [
  { key: "task", title: "Task", values: (p) => p.tasks },
  {
    key: "year",
    title: "Year",
    values: (p) => [yearBucket(p.year)],
    order: (a, b) => BUCKET_ORDER.indexOf(a.value) - BUCKET_ORDER.indexOf(b.value),
  },
];

function PapersPage() {
  const { papers, failed } = Route.useLoaderData();
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

  const {
    filtered,
    options,
    active: activeFilters,
  } = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const search = (p: Paper) =>
      !lq ||
      p.title.toLowerCase().includes(lq) ||
      p.abstract.toLowerCase().includes(lq) ||
      p.venue.toLowerCase().includes(lq) ||
      p.authors.some((a) => a.toLowerCase().includes(lq));
    return computeFacets(papers, FACETS, selected, search);
  }, [papers, q, selected]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Papers", url: "https://openodia.com/papers" },
        ])}
      />

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Research</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia NLP <span className="text-gradient">papers</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Work on Odia language technology, gathered from OpenAlex and arXiv. A paper is listed when
          its title or abstract names Odia or Oriya <em>and</em> it is classified under natural
          language processing — otherwise an index of Odia work fills up with papers about Odisha.
          Task labels below are keyword matches, meant for filtering rather than as claims by the
          authors.
        </p>
      </Reveal>

      {failed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          Both paper sources are unreachable right now. Reload in a minute.
        </p>
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
            placeholder="Search titles, abstracts, authors, venues… [/]"
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

      <div className="mt-8 space-y-4">
        {filtered.length === 0 ? (
          <EmptyResults query={q} filters={activeFilters} onClearAll={clearAll} noun="papers" />
        ) : (
          filtered.slice(0, shownCount).map((p) => (
            <article
              key={p.id}
              className="anim-in rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {p.year && <span>{p.year}</span>}
                {p.venue && <span className="truncate">· {p.venue}</span>}
                {p.openAccess && (
                  <span className="rounded-full border border-neon/40 bg-neon/5 px-2 py-0.5 text-neon">
                    Open access
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold leading-tight">
                <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-neon">
                  {p.title}
                </a>
              </h2>
              {p.authors.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{p.authors.join(", ")}</p>
              )}
              {p.abstract && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.abstract}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.tasks.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-3">
                  {p.pdfUrl && (
                    <a
                      href={p.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-neon"
                    >
                      <FileText size={12} /> PDF
                    </a>
                  )}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-neon"
                  >
                    <ExternalLink size={12} /> Source
                  </a>
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <ResultCount
            shown={Math.min(shownCount, filtered.length)}
            total={filtered.length}
            noun="papers"
          />
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
