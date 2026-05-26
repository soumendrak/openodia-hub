import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Heart, Download, Eye, Loader2 } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [
      { title: "Datasets · OpenOdia" },
      {
        name: "description",
        content:
          "Live browser of Odia-language datasets on Hugging Face — parallel corpora, speech, classification, instruction-tuning. Modal preview of sample rows for every previewable dataset.",
      },
      { property: "og:title", content: "Datasets · OpenOdia" },
      {
        property: "og:description",
        content: "Live browser of Odia datasets on Hugging Face with in-page sample previews.",
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
  previewable: boolean;
};

type Resp = { datasets: Dataset[]; fetchedAt: string };

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; columns: string[]; rows: Record<string, unknown>[] };

const DATASETS_SERVER = "https://datasets-server.huggingface.co";

async function fetchPreview(id: string): Promise<PreviewState> {
  try {
    const splitsRes = await fetch(`${DATASETS_SERVER}/splits?dataset=${encodeURIComponent(id)}`);
    if (!splitsRes.ok) throw new Error(`splits ${splitsRes.status}`);
    const splitsData = (await splitsRes.json()) as {
      splits?: { config: string; split: string }[];
    };
    const first = splitsData.splits?.[0];
    if (!first) throw new Error("no splits available");

    const rowsUrl =
      `${DATASETS_SERVER}/rows?dataset=${encodeURIComponent(id)}` +
      `&config=${encodeURIComponent(first.config)}` +
      `&split=${encodeURIComponent(first.split)}&offset=0&length=5`;
    const rowsRes = await fetch(rowsUrl);
    if (!rowsRes.ok) throw new Error(`rows ${rowsRes.status}`);
    const rowsData = (await rowsRes.json()) as {
      rows?: { row: Record<string, unknown> }[];
      features?: { name: string }[];
    };
    const rows = (rowsData.rows ?? []).map((r) => r.row);
    const columns = rowsData.features?.map((f) => f.name) ?? Object.keys(rows[0] ?? {});
    return { status: "ready", columns, rows };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "preview unavailable",
    };
  }
}

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
  const [previewing, setPreviewing] = useState<Dataset | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const previewCache = useRef<Map<string, PreviewState>>(new Map());
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

  useEffect(() => {
    if (!previewing) {
      setPreviewState(null);
      return;
    }
    const cached = previewCache.current.get(previewing.id);
    if (cached) {
      setPreviewState(cached);
      return;
    }
    setPreviewState({ status: "loading" });
    let cancelled = false;
    fetchPreview(previewing.id).then((state) => {
      previewCache.current.set(previewing.id, state);
      if (!cancelled) setPreviewState(state);
    });
    return () => {
      cancelled = true;
    };
  }, [previewing]);

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
          Live from Hugging Face — every dataset tagged for Odia. Cards with a{" "}
          <span className="inline-flex items-center gap-1 text-neon">
            <Eye size={12} /> Preview
          </span>{" "}
          badge open a modal showing the first few rows.
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

      <div className="mt-8 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <DatasetCard key={d.id} dataset={d} index={i} onPreview={() => setPreviewing(d)} />
          ))
        )}
      </div>

      <PreviewModal dataset={previewing} state={previewState} onClose={() => setPreviewing(null)} />
    </div>
  );
}

function DatasetCard({
  dataset: d,
  index,
  onPreview,
}: {
  dataset: Dataset;
  index: number;
  onPreview: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: Math.min(index, 12) * 0.02,
      }}
      whileHover={{ y: -4 }}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {prettyTask(d.task)}
        </span>
        {d.previewable && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neon transition hover:border-neon hover:bg-neon/20"
            aria-label="Preview sample rows"
            title="Preview sample rows"
          >
            <Eye size={10} /> Preview
          </button>
        )}
      </div>
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block transition hover:text-neon"
      >
        <h3 className="font-display text-lg font-semibold leading-tight">{d.name}</h3>
      </a>
      <p className="mt-1 truncate text-xs text-muted-foreground">@{d.author}</p>
      {d.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
      )}
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Download size={12} /> {formatCount(d.downloads)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart size={12} /> {formatCount(d.likes)}
        </span>
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 transition hover:text-neon"
          aria-label="Open on Hugging Face"
        >
          <ExternalLink size={12} /> Hugging Face
        </a>
      </div>
      {d.previewable && (
        <button
          type="button"
          onClick={onPreview}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-neon/30 bg-neon/5 px-4 py-2 text-sm font-medium text-neon transition hover:border-neon hover:bg-neon/15"
        >
          <Eye size={14} /> Preview sample rows
        </button>
      )}
    </motion.div>
  );
}

function PreviewModal({
  dataset,
  state,
  onClose,
}: {
  dataset: Dataset | null;
  state: PreviewState | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!dataset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl border-border bg-surface text-foreground">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-2xl">
            {dataset?.name ?? "Dataset preview"}
          </DialogTitle>
          {dataset && (
            <DialogDescription className="text-sm text-muted-foreground">
              @{dataset.author} · {prettyTask(dataset.task)} ·{" "}
              <a
                href={dataset.url}
                target="_blank"
                rel="noreferrer"
                className="text-neon hover:underline"
              >
                Open on Hugging Face ↗
              </a>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto">
          {(!state || state.status === "loading") && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Fetching the first rows from Hugging Face…
            </div>
          )}
          {state?.status === "error" && (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              <p>
                The Hugging Face datasets-server couldn&rsquo;t serve a preview right now (
                {state.message}). This can happen when the dataset server hasn&rsquo;t finished
                processing yet.
              </p>
              {dataset && (
                <a
                  href={`${dataset.url}/viewer`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-neon hover:underline"
                >
                  Open the full viewer on Hugging Face →
                </a>
              )}
            </div>
          )}
          {state?.status === "ready" && state.rows.length === 0 && (
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              No rows returned for this split.
            </div>
          )}
          {state?.status === "ready" && state.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-background/40">
              <table className="w-full text-xs">
                <thead className="bg-background/60">
                  <tr className="border-b border-border">
                    {state.columns.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      {state.columns.map((c) => (
                        <td key={c} className="max-w-[20rem] px-3 py-2 align-top leading-relaxed">
                          <Cell value={row[c]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-muted-foreground/60">null</span>;
  }
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const truncated = str.length > 180;
  const display = truncated ? str.slice(0, 180) + "…" : str;
  return (
    <span className="block whitespace-pre-wrap break-words" title={truncated ? str : undefined}>
      {display}
    </span>
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
