import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import { Reveal } from "../components/Reveal";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools · Awesome Odia AI" },
      { name: "description", content: "A live, searchable directory of Odia language datasets, models, libraries, and AI tools — synced from Awesome-Odia-AI." },
      { property: "og:title", content: "Tools · Awesome Odia AI" },
      { property: "og:description", content: "Searchable directory of Odia language datasets, models, libraries, and AI tools." },
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

type Resp = { items: Item[]; fetchedAt: string };

function ToolsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["awesome"],
    queryFn: async () => {
      const r = await fetch("/api/awesome");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Resp;
    },
    staleTime: 60 * 60 * 1000,
  });

  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.items.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const lq = q.toLowerCase();
    return data.items.filter((i) => {
      if (active && i.category !== active) return false;
      if (!lq) return true;
      return (
        i.name.toLowerCase().includes(lq) ||
        i.description.toLowerCase().includes(lq) ||
        i.category.toLowerCase().includes(lq)
      );
    });
  }, [data, q, active]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Directory</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Every Odia AI tool,{" "}
          <span className="text-gradient">in one place.</span>
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tools, datasets, models…"
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
            All ({data?.items.length ?? 0})
          </Chip>
          {categories.map((c) => {
            const count = data?.items.filter((i) => i.category === c).length ?? 0;
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

      {data && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Updated {new Date(data.fetchedAt).toLocaleString()} · {data.items.length} entries
        </p>
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
