import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Heart, Download } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [
      { title: "Datasets · OpenOdia" },
      {
        name: "description",
        content:
          "Live browser of Odia-language datasets on Hugging Face — parallel corpora, speech, classification, instruction-tuning, and more.",
      },
      { property: "og:title", content: "Datasets · OpenOdia" },
      {
        property: "og:description",
        content: "Live browser of Odia-language datasets on Hugging Face.",
      },
    ],
  }),
  component: DatasetsPage,
});

type Dataset = {
  id: string;
  author: string;
  name: string;
  url: string;
  description: string;
  task: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
};

type Resp = { datasets: Dataset[]; fetchedAt: string };

function prettyTask(t: string): string {
  if (t === "other") return "Other";
  return t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function DatasetsPage() {
  const [q, setQ] = useState("");
  const [task, setTask] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const { data, isLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const r = await fetch("/api/datasets");
      if (!r.ok) throw new Error("datasets");
      return (await r.json()) as Resp;
    },
    staleTime: 60 * 60 * 1000,
  });

  const datasets = data?.datasets ?? [];

  const tasks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of datasets) counts.set(d.task, (counts.get(d.task) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [datasets]);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return datasets.filter((d) => {
      if (task && d.task !== task) return false;
      if (!lq) return true;
      return (
        d.id.toLowerCase().includes(lq) ||
        d.author.toLowerCase().includes(lq) ||
        d.task.toLowerCase().includes(lq) ||
        d.description.toLowerCase().includes(lq) ||
        d.tags.some((t) => t.toLowerCase().includes(lq))
      );
    });
  }, [datasets, q, task]);

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
          classification, instruction-tuning. Click any card to preview on Hugging Face.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <div className="relative max-w-xl">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search datasets, authors, tags… [/]"
            className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
          />
        </div>

        {tasks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={task === null} onClick={() => setTask(null)}>
              All ({datasets.length})
            </Chip>
            {tasks.map(([t, count]) => (
              <Chip key={t} active={task === t} onClick={() => setTask(task === t ? null : t)}>
                {prettyTask(t)} ({count})
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
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-muted-foreground">No datasets matched.</p>
        ) : (
          filtered.map((d, i) => (
            <motion.a
              key={d.id}
              href={d.url}
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
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
              )}
              <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Download size={12} /> {formatCount(d.downloads)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} /> {formatCount(d.likes)}
                </span>
              </div>
            </motion.a>
          ))
        )}
      </div>
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
