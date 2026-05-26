import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, RefreshCw, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon } from "../components/icons";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";

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
  const [page, setPage] = useState(1);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp on display so a filter that shrinks the result set doesn't strand
  // the user on a non-existent page; filter handlers reset `page` to 1 too.
  const displayPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((displayPage - 1) * PAGE_SIZE, displayPage * PAGE_SIZE);

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
                setPage(1);
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
              setPage(1);
            }}
          >
            All ({total})
          </Chip>
          <Chip
            active={typeFilter === "tool"}
            onClick={() => {
              setTypeFilter(typeFilter === "tool" ? "all" : "tool");
              setPage(1);
            }}
          >
            Tools ({toolCount})
          </Chip>
          <Chip
            active={typeFilter === "repo"}
            onClick={() => {
              setTypeFilter(typeFilter === "repo" ? "all" : "repo");
              setPage(1);
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
                  setPage(1);
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
        ) : pageItems.length === 0 ? (
          <p className="col-span-full text-muted-foreground">No projects matched.</p>
        ) : (
          pageItems.map((item, i) => (
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

      {!isLoading && totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Page {displayPage} of {totalPages} · {filtered.length} matching
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={displayPage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm hover:border-neon hover:text-neon disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                  p === displayPage
                    ? "border border-neon bg-neon/10 text-neon"
                    : "border border-border hover:border-neon/40 hover:text-foreground text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={displayPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm hover:border-neon hover:text-neon disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
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
