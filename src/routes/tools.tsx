import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useDeferredValue, useMemo, useState, useRef } from "react";
import { Search, ExternalLink, RefreshCw, Star, ChevronDown } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon } from "../components/icons";
import { ActiveFilterBar, Chip, EmptyResults, FacetGroup, ResultCount } from "../components/Facets";
import { ResourceMeta } from "../components/ResourceMeta";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { pageHead } from "../lib/seo";
import {
  computeFacets,
  toggleSelection,
  type ActiveFilter,
  type FacetDef,
  type Selection,
} from "../lib/facets";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import { licenseFromProse, normalizeSpdx } from "../lib/license";
import { refFromUrl, refToPath } from "../lib/resource-id";
import { pickWeeklyFeatured } from "../lib/weekly-picks";
import { loadAwesome, type Item as AwesomeItem } from "../lib/sources/awesome";
import { loadAwesomeLicenses, type LicenseMap } from "../lib/sources/awesome-licenses";
import { loadRepos, type Repo } from "../lib/sources/repos";

/**
 * Runs on the server during SSR and over RPC on client navigation, so the
 * directory is in the server HTML rather than arriving after hydration.
 *
 * The two sources fail independently: a GitHub rate-limit shouldn't take the
 * curated list down with it.
 */
const getDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const [awesome, repos, licenses] = await Promise.allSettled([
    loadAwesome(),
    loadRepos(),
    loadAwesomeLicenses(),
  ]);
  if (awesome.status === "rejected") console.error("awesome loader:", awesome.reason);
  if (repos.status === "rejected") console.error("repos loader:", repos.reason);
  if (licenses.status === "rejected") console.error("awesome licenses loader:", licenses.reason);
  return {
    awesome: awesome.status === "fulfilled" ? awesome.value : ([] as AwesomeItem[]),
    repos: repos.status === "fulfilled" ? repos.value : ([] as Repo[]),
    // Missing licenses degrade to "No license", the old behaviour — never fatal.
    licenses: licenses.status === "fulfilled" ? licenses.value : ({} as LicenseMap),
    awesomeFailed: awesome.status === "rejected",
    reposFailed: repos.status === "rejected",
  };
});

export const Route = createFileRoute("/tools")({
  head: () =>
    pageHead({
      path: "tools",
      title: "Tools · OpenOdia",
      description:
        "Every Odia open-source project — fonts, datasets, models, libraries, apps, repos, and tools — searchable by task and license, with citations.",
      ogDescription:
        "Unified directory of open-source Odia projects — repos, datasets, models, libraries, fonts, and more.",
    }),
  loader: () => getDirectory(),
  staleTime: 60 * 60 * 1000,
  component: ToolsPage,
});

type DirectoryItem = {
  source: "repo" | "tool";
  key: string;
  name: string;
  url: string;
  description: string;
  category: string;
  subcategory?: string;
  license: string;
  /** Internal permalink, when the entry resolves to a repo/model/dataset. */
  href?: string;
  stars?: number;
  language?: string;
  createdAt?: string;
  /** Attribution for the citation — falls back to the host for a bare link. */
  author: string;
  /** Owning GitHub/Hugging Face account, when the entry has one. Facet source. */
  org?: string;
};

const CODE_REPOS_CATEGORY = "Code Repositories";
const PAGE_SIZE = 30;
const TYPE_LABEL: Record<string, string> = { repo: "Repos", tool: "Curated" };

function ToolsPage() {
  const { awesome, repos, licenses, awesomeFailed, reposFailed } = Route.useLoaderData();
  const router = useRouter();

  // Load More — show items 0..shownCount, button bumps by PAGE_SIZE. Filters
  // reset back to the initial window so a fresh narrow doesn't open with
  // hundreds of cards already visible.
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Selection>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const resetPage = () => setShownCount(PAGE_SIZE);

  const toggle = (facet: string) => (value: string) => {
    setSelected((prev) => toggleSelection(prev, facet, value));
    resetPage();
  };

  // Merge sources into a single normalized list. URL-based dedup keeps the
  // curated Awesome entry when both list the same project.
  const items: DirectoryItem[] = useMemo(() => {
    // Keys include the array index because the Awesome list reuses the same
    // paper URL across several entries (e.g. one paper covers both a dataset
    // and a model). Without the index React sees duplicate keys, drops cards,
    // and keeps stale DOM nodes alive when filters change.
    const tools: DirectoryItem[] = awesome.map((a, idx) => {
      // A curated row that points at GitHub or Hugging Face is the same
      // resource as the repo/model card, so it gets the same permalink.
      const href = awesomeHref(a.url);
      return {
        source: "tool" as const,
        key: `tool:${idx}:${a.url}`,
        name: a.name,
        url: a.url,
        description: a.description,
        category: a.category,
        subcategory: a.subcategory,
        // Awesome-Odia-AI states the license inline in the blurb for a
        // minority of rows; the rest inherit it from the repo or model card
        // the row points at.
        license: licenseFromProse(a.description) || (href ? (licenses[href] ?? "") : ""),
        href,
        author: hostOwner(a.url),
        org: refFromUrl(a.url)?.id.split("/")[0],
      };
    });
    const toolUrls = new Set(awesome.map((a) => a.url));
    const repoItems: DirectoryItem[] = repos
      .filter((r) => !toolUrls.has(r.html_url))
      .map((r, idx) => ({
        source: "repo" as const,
        key: `repo:${idx}:${r.full_name}`,
        name: r.full_name,
        url: r.html_url,
        description: r.description ?? "",
        category: CODE_REPOS_CATEGORY,
        subcategory: r.full_name.split("/")[0],
        license: normalizeSpdx(r.license?.spdx_id),
        href: refToPath({ kind: "gh", id: r.full_name }),
        stars: r.stargazers_count,
        language: r.language ?? undefined,
        createdAt: r.created_at,
        author: r.full_name.split("/")[0],
        org: r.full_name.split("/")[0],
      }))
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    return [...tools, ...repoItems];
  }, [awesome, repos, licenses]);

  // Five repos featured above the directory, drawn from a seeded shuffle keyed
  // on the ISO week — same set for every visitor all week, rotates itself every
  // Monday. Deterministic, so SSR and the client agree. See lib/weekly-picks.
  const featured = useMemo(() => pickWeeklyFeatured(repos, new Date()), [repos]);

  // Categories keep the order they appear in the merged list, so the curated
  // Awesome ordering is preserved and "Code Repositories" lands last.
  const categoryOrder = useMemo(() => {
    const order = new Map<string, number>();
    for (const i of items) if (!order.has(i.category)) order.set(i.category, order.size);
    return order;
  }, [items]);

  const facets: FacetDef<DirectoryItem>[] = useMemo(
    () => [
      { key: "type", title: "Source", values: (i) => [i.source], label: (v) => TYPE_LABEL[v] ?? v },
      {
        key: "category",
        title: "Category",
        values: (i) => [i.category],
        order: (a, b) =>
          (categoryOrder.get(a.value) ?? Infinity) - (categoryOrder.get(b.value) ?? Infinity),
      },
      // R7: the hub visibly hosts many actors, so the owning organisation is a
      // first-class way to browse. Only entries resolving to a GitHub/HF
      // account have one — a bare arxiv.org link is a paper, not an actor.
      { key: "org", title: "Organisation", values: (i) => [i.org ?? ""] },
      { key: "license", title: "License", values: (i) => [i.license] },
    ],
    [categoryOrder],
  );

  const clearAll = () => {
    setSelected({});
    setQ("");
    resetPage();
  };

  const removeFilter = (f: ActiveFilter) => toggle(f.facet)(f.value);

  // Cross-filtered counts: each facet is counted against the *other* facets'
  // selections, so a number is always what selecting it returns.
  // The input renders from `q` so keystrokes always land immediately; the
  // ~300-item facet recount runs off the deferred copy, so a fast typist is
  // never waiting on a grid re-render between characters.
  const deferredQ = useDeferredValue(q);

  const {
    filtered,
    options,
    active: activeFilters,
  } = useMemo(() => {
    const lq = deferredQ.trim().toLowerCase();
    const search = (i: DirectoryItem) =>
      !lq ||
      i.name.toLowerCase().includes(lq) ||
      i.description.toLowerCase().includes(lq) ||
      i.category.toLowerCase().includes(lq) ||
      (i.subcategory ?? "").toLowerCase().includes(lq) ||
      (i.language ?? "").toLowerCase().includes(lq);
    return computeFacets(items, facets, selected, search);
  }, [items, deferredQ, selected, facets]);

  const visibleItems = filtered.slice(0, shownCount);
  const hasMore = filtered.length > shownCount;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Tools", url: "https://openodia.com/tools" },
        ])}
      />
      {items.length > 0 && (
        <JsonLd
          data={itemListSchema(
            items.slice(0, 50).map((i) => ({
              name: i.name,
              url: i.url,
              description: i.description,
            })),
            "Odia open-source directory",
            "Every Odia open-source project — repos, datasets, models, libraries, fonts, and tools.",
          )}
        />
      )}

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Directory</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Every Odia project, <span className="text-gradient">in one place.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Open-source repos, datasets, models, fonts, libraries, and tools — curated from
          Awesome-Odia-AI and the Odia GitHub organisations, filterable by license and citable in
          one click.
        </p>
      </Reveal>

      {featured.hero.length > 0 && (
        <Reveal delay={0.05} className="mt-12">
          <SectionLabel tag="★ Featured" note="rotates every Monday" />
          <div className="grid gap-4 md:grid-cols-2">
            {featured.hero.map((r) => (
              <HeroCard key={r.full_name} repo={r} />
            ))}
          </div>
          {featured.reels.length > 0 && (
            <>
              <SectionLabel tag="Also worth a look" />
              <div className="grid gap-4 sm:grid-cols-3">
                {featured.reels.map((r) => (
                  <ReelCard key={r.full_name} repo={r} />
                ))}
              </div>
            </>
          )}
        </Reveal>
      )}

      <Reveal delay={0.1} className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
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
              placeholder="Search projects, repos, datasets, models… [/]"
              className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
            />
          </div>
          <button
            onClick={() => router.invalidate()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-3 text-sm hover:border-neon hover:text-neon"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {/* The limits differ per facet: categories and organisations have long
              tails, licenses do not. */}
          {facets.map((f) => (
            <FacetGroup
              key={f.key}
              title={f.title}
              options={options[f.key]}
              selected={selected[f.key] ?? new Set()}
              onToggle={toggle(f.key)}
              limit={f.key === "category" ? 8 : f.key === "org" ? 10 : 12}
            />
          ))}
        </div>

        <ActiveFilterBar filters={activeFilters} onRemove={removeFilter} onClearAll={clearAll} />
      </Reveal>

      {/* Each source fails on its own — say which one, so a partial directory
          doesn't read as a complete one. */}
      {reposFailed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          GitHub is rate-limiting us, so the code repositories are missing below. Curated entries
          are unaffected — try Refresh in a minute.
        </p>
      )}
      {awesomeFailed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          The Awesome-Odia-AI list is unreachable, so curated entries are missing below.
        </p>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleItems.length === 0 ? (
          <EmptyResults query={q} filters={activeFilters} onClearAll={clearAll} noun="projects" />
        ) : (
          // No entrance animation and no stagger on the cards. Thirty JS
          // springs re-running on every keystroke, filter toggle, and Load
          // more was the single slowest thing on this page — and a result
          // that fades in after you have already read the count reads as
          // lag, not polish. Results appear the instant they are filtered.
          visibleItems.map((item) => (
            <div
              key={item.key}
              className="group flex h-full min-w-0 flex-col rounded-2xl border border-border bg-surface transition-colors hover:border-neon/40"
            >
              <CardLink item={item}>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.subcategory ?? item.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.source === "repo" ? (
                      <>
                        <GithubIcon size={12} /> Repo
                      </>
                    ) : (
                      <>Curated</>
                    )}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-tight">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted-foreground">
                  {item.source === "repo" && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} className="text-saffron" />
                        {item.stars ?? 0}
                      </span>
                      {item.language && (
                        <span className="rounded-full border border-border px-2 py-0.5">
                          {item.language}
                        </span>
                      )}
                    </>
                  )}
                  <ExternalLink
                    size={14}
                    className="ml-auto text-muted-foreground transition group-hover:text-neon"
                  />
                </div>
              </CardLink>
              <ResourceMeta
                license={item.license}
                entry={{
                  name: item.name,
                  author: item.author,
                  url: item.url,
                  createdAt: item.createdAt,
                }}
              />
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <ResultCount shown={visibleItems.length} total={filtered.length} noun="projects" />
          {hasMore && (
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

/**
 * Curated rows that resolve to a repo/model/dataset get the internal permalink;
 * the rest (papers, project homepages) still link straight out.
 */
function awesomeHref(url: string): string | undefined {
  const ref = refFromUrl(url);
  return ref ? refToPath(ref) : undefined;
}

const CARD_LINK_CLASS = "flex flex-1 flex-col p-5";

function CardLink({ item, children }: { item: DirectoryItem; children: React.ReactNode }) {
  if (item.href) {
    return (
      <Link to={item.href} className={CARD_LINK_CLASS}>
        {children}
      </Link>
    );
  }
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className={CARD_LINK_CLASS}>
      {children}
    </a>
  );
}

/**
 * Best-effort attribution for a curated entry: the owning account on GitHub or
 * Hugging Face, else the host. Used only for the citation's author field.
 */
function hostOwner(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (/github\.com|huggingface\.co|gitlab\.com/.test(u.host)) {
      if (parts[0] === "datasets" || parts[0] === "spaces") return parts[1] ?? u.host;
      return parts[0] ?? u.host;
    }
    return u.host.replace(/^www\./, "");
  } catch {
    return "OpenOdia";
  }
}

function SectionLabel({ tag, note }: { tag: string; note?: string }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground first:mt-0">
      <span className="whitespace-nowrap rounded-full border border-saffron/40 px-2 py-0.5 text-saffron">
        {tag}
      </span>
      {note && <span>{note}</span>}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function HeroCard({ repo }: { repo: Repo }) {
  const owner = repo.full_name.split("/")[0];
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      className="group hover-lift relative flex min-h-[235px] items-end overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-neon/50"
    >
      {/* Blurred repo card as ambient backdrop — decorative, so alt="".
          opengraph.githubassets.com rate-limits hard (429); hide the broken
          image and let the card's own surface + gradient carry it. */}
      <img
        src={`https://opengraph.githubassets.com/1/${repo.full_name}`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] scale-110 object-cover opacity-40 blur-2xl saturate-150"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background/95" />
      <div className="relative w-full p-6">
        <img
          src={`https://github.com/${owner}.png?size=104`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="mb-3 h-13 w-13 rounded-2xl border border-foreground/20"
          width={52}
          height={52}
        />
        <span className="text-[10px] uppercase tracking-[0.14em] text-neon">
          {repo.language ?? "Resource"}
        </span>
        <h3 className="mt-1 break-words font-display text-xl font-semibold leading-tight md:text-2xl">
          {repo.name}
        </h3>
        {repo.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="text-saffron" />
            {repo.stargazers_count}
          </span>
          {repo.language && (
            <span className="rounded-full border border-border px-2 py-0.5">{repo.language}</span>
          )}
          <ExternalLink size={14} className="ml-auto transition group-hover:text-neon" />
        </div>
      </div>
    </a>
  );
}

function ReelCard({ repo }: { repo: Repo }) {
  const owner = repo.full_name.split("/")[0];
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      className="group hover-lift relative flex min-h-[118px] flex-col justify-end gap-1 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-neon/50"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5 bg-[radial-gradient(140%_160%_at_12%_0%,color-mix(in_oklab,var(--neon)_22%,transparent),transparent_65%)]"
      />
      <img
        src={`https://github.com/${owner}.png?size=76`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="relative mb-1 h-9.5 w-9.5 rounded-xl border border-border bg-surface-2"
        width={38}
        height={38}
      />
      <h3 className="relative break-words font-display text-sm font-semibold leading-tight">
        {repo.name}
      </h3>
      <span className="relative flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star size={11} className="text-saffron" />
          {repo.stargazers_count}
        </span>
        {repo.language ?? "Resource"}
      </span>
    </a>
  );
}
