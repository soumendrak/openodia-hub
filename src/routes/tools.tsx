import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools · Awesome Odia AI" },
      {
        name: "description",
        content:
          "A live, searchable directory of Odia language datasets, models, libraries, and AI tools — synced from Awesome-Odia-AI.",
      },
      { property: "og:title", content: "Tools · Awesome Odia AI" },
      {
        property: "og:description",
        content: "Searchable directory of Odia language datasets, models, libraries, and AI tools.",
      },
    ],
  }),
  component: ToolsPage,
});

type Item = {
  category: string;
  subcategory?: string;
  name: string;
  url: string;
  description: string;
};

type Page = {
  items: Item[];
  fetchedAt: string;
  nextCursor?: string;
  total: number;
};

const PAGE_SIZE = 30;

function ToolsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const cursor = String((page - 1) * PAGE_SIZE);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["awesome", cursor],
    queryFn: async () => {
      const r = await fetch(`/api/awesome?cursor=${cursor}&limit=${PAGE_SIZE}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Page;
    },
    staleTime: 60 * 60 * 1000,
  });

  const allItems = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const fetchedAt = data?.fetchedAt;

  const categories = useMemo(() => {
    if (!allItems.length) return [];
    const set = new Set<string>();
    allItems.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [allItems]);

  const filtered = useMemo(() => {
    if (!allItems.length) return [];
    const lq = q.toLowerCase();
    return allItems.filter((i) => {
      if (active && i.category !== active) return false;
      if (!lq) return true;
      return (
        i.name.toLowerCase().includes(lq) ||
        i.description.toLowerCase().includes(lq) ||
        i.category.toLowerCase().includes(lq)
      );
    });
  }, [allItems, q, active]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Tools", url: "https://openodia.com/tools" },
        ])}
      />
      {data && (
        <JsonLd
          data={itemListSchema(
            allItems.slice(0, 50).map((i) => ({
              name: i.name,

              name: i.name,
              url: i.url,
              description: i.description,
            })),
            "Awesome Odia AI Tools",
            "A curated directory of Odia language datasets, models, libraries, and AI tools",
          )}
        />
      )}
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Directory</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Every Odia AI tool, <span className="text-gradient">in one place.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Live-synced from{" "}
          <a
            href="https://github.com/odisha-ml/Awesome-Odia-AI"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            odisha-ml/Awesome-Odia-AI
          </a>
          . Datasets, models, libraries, papers — search and explore.
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tools, datasets, models… [/]"
              className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-3 text-sm hover:border-neon hover:text-neon"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={active === null} onClick={() => setActive(null)}>
            All ({total})
          </Chip>
          {categories.map((c) => {
            const count = allItems.filter((i) => i.category === c).length;
            return (
              <Chip
                key={c}
                active={active === c}
                onClick={() => setActive(active === c ? null : c)}
              >
                {c} ({count})
              </Chip>
            );
          })}
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))
          : filtered.map((item, i) => (
              <motion.a
                key={`${item.url}-${i}`}
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
                className="group block rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.subcategory ?? item.category}
                  </span>
                  <ExternalLink
                    size={14}
                    className="text-muted-foreground transition group-hover:text-neon"
                  />
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-tight">
                  {item.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </motion.a>
            ))}
      </div>

      {data && totalPages > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Updated {new Date(fetchedAt!).toLocaleString()} · Page {page} of {totalPages} ({total}{" "}
            tools)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-sm hover:border-neon hover:text-neon disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                  p === page
                    ? "border border-neon bg-neon/10 text-neon"
                    : "border border-border hover:border-neon/40 hover:text-foreground text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
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
