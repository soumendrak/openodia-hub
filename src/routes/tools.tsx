import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, RefreshCw, Star, ChevronDown } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon } from "../components/icons";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import { pickWeeklyFeatured } from "../lib/weekly-picks";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools · OpenOdia" },
      {
        name: "description",
        content:
          "Every Odia open-source project — fonts, datasets, models, libraries, apps, repos, and tools — searchable in one place.",
      },
      { property: "og:title", content: "Tools · OpenOdia" },
      {
        property: "og:description",
        content:
          "Unified directory of open-source Odia projects — repos, datasets, models, libraries, fonts, and more.",
      },
    ],
  }),
  component: ToolsPage,
});

type AwesomeItem = {
  category: string;
  subcategory?: string;
  name: string;
  url: string;
  description: string;
};

type AwesomeResp = {
  items: AwesomeItem[];
  fetchedAt: string;
};

type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
};

type ReposResp = { repos: Repo[] };

type DirectoryItem = {
  source: "repo" | "tool";
  key: string;
  name: string;
  url: string;
  description: string;
  category: string;
  subcategory?: string;
  stars?: number;
  language?: string;
};

const CODE_REPOS_CATEGORY = "Code Repositories";
const PAGE_SIZE = 30;
type TypeFilter = "all" | "repo" | "tool";

function ToolsPage() {
  // Load More — show items 0..shownCount, button bumps by PAGE_SIZE.
  // Filters reset back to the initial window so a fresh narrow doesn't
  // open with hundreds of cards already visible.
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const {
    data: awesomeData,
    isLoading: awesomeLoading,
    refetch: refetchAwesome,
    isFetching: awesomeFetching,
  } = useQuery({
    queryKey: ["awesome", "all"],
    queryFn: async () => {
      const r = await fetch("/api/awesome");
      if (!r.ok) throw new Error("awesome");
      return (await r.json()) as AwesomeResp;
    },
    staleTime: 60 * 60 * 1000,
  });

  const {
    data: reposData,
    isLoading: reposLoading,
    refetch: refetchRepos,
    isFetching: reposFetching,
  } = useQuery({
    queryKey: ["repos", "all"],
    queryFn: async () => {
      const r = await fetch("/api/repos");
      if (!r.ok) throw new Error("repos");
      return (await r.json()) as ReposResp;
    },
    staleTime: 60 * 60 * 1000,
  });

  const isLoading = awesomeLoading || reposLoading;
  const isFetching = awesomeFetching || reposFetching;

  // Merge sources into a single normalized list. URL-based dedup keeps the
  // curated Awesome entry when both list the same project.
  const items: DirectoryItem[] = useMemo(() => {
    const awesome = awesomeData?.items ?? [];
    const repos = reposData?.repos ?? [];
    // Keys include the array index because the Awesome list reuses the same
    // paper URL across several entries (e.g. one paper covers both a dataset
    // and a model). Without the index React sees duplicate keys, drops cards,
    // and keeps stale DOM nodes alive when filters change.
    const tools: DirectoryItem[] = awesome.map((a, idx) => ({
      source: "tool",
      key: `tool:${idx}:${a.url}`,
      name: a.name,
      url: a.url,
      description: a.description,
      category: a.category,
      subcategory: a.subcategory,
    }));
    const toolUrls = new Set(awesome.map((a) => a.url));
    const repoItems: DirectoryItem[] = repos
      .filter((r) => !toolUrls.has(r.html_url))
      .map((r, idx) => ({
        source: "repo",
        key: `repo:${idx}:${r.full_name}`,
        name: r.full_name,
        url: r.html_url,
        description: r.description ?? "",
        category: CODE_REPOS_CATEGORY,
        subcategory: r.full_name.split("/")[0],
        stars: r.stargazers_count,
        language: r.language ?? undefined,
      }))
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    return [...tools, ...repoItems];
  }, [awesomeData, reposData]);

  const total = items.length;

  // Five repos featured above the directory, drawn from a seeded shuffle keyed
  // on the ISO week — same set for every visitor all week, rotates itself every
  // Monday. Deterministic, so SSR and the client agree. See lib/weekly-picks.
  const featured = useMemo(
    () => pickWeeklyFeatured(reposData?.repos ?? [], new Date()),
    [reposData],
  );

  // Categories surfaced in the order they appear in the merged list, so the
  // curated Awesome ordering is preserved and "Code Repositories" lands last.
  const categories = useMemo(() => {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const i of items) {
      if (!counts.has(i.category)) order.push(i.category);
      counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    }
    return order.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items.length) return [];
    const lq = q.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter !== "all" && i.source !== typeFilter) return false;
      if (category && i.category !== category) return false;
      if (!lq) return true;
      return (
        i.name.toLowerCase().includes(lq) ||
        i.description.toLowerCase().includes(lq) ||
        i.category.toLowerCase().includes(lq) ||
        (i.subcategory ?? "").toLowerCase().includes(lq) ||
        (i.language ?? "").toLowerCase().includes(lq)
      );
    });
  }, [items, q, category, typeFilter]);

  const visibleItems = filtered.slice(0, shownCount);
  const hasMore = filtered.length > shownCount;

  const repoCount = items.filter((i) => i.source === "repo").length;
  const toolCount = items.filter((i) => i.source === "tool").length;

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
          Awesome-Odia-AI and the OpenOdia GitHub orgs.
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
          <div className="relative flex-1 min-w-[260px]">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShownCount(PAGE_SIZE);
              }}
              placeholder="Search projects, repos, datasets, models… [/]"
              className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
            />
          </div>
          <button
            onClick={() => {
              refetchAwesome();
              refetchRepos();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-3 text-sm hover:border-neon hover:text-neon"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip
            active={typeFilter === "all"}
            onClick={() => {
              setTypeFilter("all");
              setShownCount(PAGE_SIZE);
            }}
          >
            All ({total})
          </Chip>
          <Chip
            active={typeFilter === "tool"}
            onClick={() => {
              setTypeFilter(typeFilter === "tool" ? "all" : "tool");
              setShownCount(PAGE_SIZE);
            }}
          >
            Tools ({toolCount})
          </Chip>
          <Chip
            active={typeFilter === "repo"}
            onClick={() => {
              setTypeFilter(typeFilter === "repo" ? "all" : "repo");
              setShownCount(PAGE_SIZE);
            }}
          >
            Repos ({repoCount})
          </Chip>
        </div>

        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip active={category === null} onClick={() => setCategory(null)}>
              All categories
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c.name}
                active={category === c.name}
                onClick={() => {
                  setCategory(category === c.name ? null : c.name);
                  setShownCount(PAGE_SIZE);
                }}
              >
                {c.name} ({c.count})
              </Chip>
            ))}
          </div>
        )}
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))
        ) : visibleItems.length === 0 ? (
          <p className="col-span-full text-muted-foreground">No projects matched.</p>
        ) : (
          visibleItems.map((item, i) => (
            <motion.a
              key={item.key}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: Math.min(i, 12) * 0.02,
              }}
              whileHover={{ y: -4 }}
              className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
            >
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
                    <>Tool</>
                  )}
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{item.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {item.description || "No description."}
              </p>
              {item.source === "repo" && (
                <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} className="text-saffron" />
                    {item.stars ?? 0}
                  </span>
                  {item.language && (
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {item.language}
                    </span>
                  )}
                  <ExternalLink
                    size={14}
                    className="ml-auto text-muted-foreground transition group-hover:text-neon"
                  />
                </div>
              )}
              {item.source === "tool" && (
                <div className="mt-auto flex items-center pt-3">
                  <ExternalLink
                    size={14}
                    className="ml-auto text-muted-foreground transition group-hover:text-neon"
                  />
                </div>
              )}
            </motion.a>
          ))
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {visibleItems.length} of {filtered.length}
          </p>
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
    <motion.a
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -4 }}
      className="group relative flex min-h-[235px] items-end overflow-hidden rounded-2xl border border-border transition hover:border-neon/50"
    >
      {/* Blurred repo card as ambient backdrop — decorative, so alt="" */}
      <img
        src={`https://opengraph.githubassets.com/1/${repo.full_name}`}
        alt=""
        aria-hidden="true"
        loading="lazy"
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
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
          {repo.description || "No description."}
        </p>
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
    </motion.a>
  );
}

function ReelCard({ repo }: { repo: Repo }) {
  const owner = repo.full_name.split("/")[0];
  return (
    <motion.a
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -4 }}
      className="group relative flex min-h-[118px] flex-col justify-end gap-1 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition hover:border-neon/50"
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
    </motion.a>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
