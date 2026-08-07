import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Heart, Download, ChevronDown } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { FeaturedGallery, formatCount } from "../components/FeaturedGallery";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import { MIN_LIKES, pickWeeklyBy } from "../lib/weekly-picks";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Models · OpenOdia" },
      {
        name: "description",
        content:
          "Live registry of Odia-language AI models on Hugging Face — LLMs, ASR, TTS, translation, embeddings, and more.",
      },
      { property: "og:title", content: "Models · OpenOdia" },
      {
        property: "og:description",
        content: "Live registry of Odia-language AI models on Hugging Face.",
      },
    ],
  }),
  component: ModelsPage,
});

type Model = {
  id: string;
  author: string;
  name: string;
  url: string;
  task: string;
  library: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
};

type Resp = { models: Model[]; fetchedAt: string };

const TASK_LABEL: Record<string, string> = {
  "text-generation": "Text generation",
  "text-classification": "Text classification",
  "token-classification": "Token classification",
  translation: "Translation",
  "automatic-speech-recognition": "Speech recognition",
  "text-to-speech": "Text-to-speech",
  "feature-extraction": "Embeddings",
  "fill-mask": "Fill mask",
  summarization: "Summarization",
  "question-answering": "Question answering",
  other: "Other",
};

function ModelsPage() {
  const PAGE_SIZE = 30;
  const [q, setQ] = useState("");
  const [task, setTask] = useState<string | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const { data, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const r = await fetch("/api/models");
      if (!r.ok) throw new Error("models");
      return (await r.json()) as Resp;
    },
    staleTime: 60 * 60 * 1000,
  });

  const models = data?.models ?? [];

  const tasks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of models) counts.set(m.task, (counts.get(m.task) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [models]);

  // Five models featured above the registry, drawn from a seeded shuffle keyed
  // on the ISO week — same set for every visitor all week, rotates itself every
  // Monday. Deterministic, so SSR and the client agree. See lib/weekly-picks.
  const featured = useMemo(() => {
    const { hero, reels } = pickWeeklyBy(models, new Date(), (m) => m.likes, MIN_LIKES);
    const toItem = (m: Model) => ({ ...m, label: TASK_LABEL[m.task] ?? m.task });
    return { hero: hero.map(toItem), reels: reels.map(toItem) };
  }, [models]);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return models.filter((m) => {
      if (task && m.task !== task) return false;
      if (!lq) return true;
      return (
        m.id.toLowerCase().includes(lq) ||
        m.author.toLowerCase().includes(lq) ||
        m.task.toLowerCase().includes(lq) ||
        m.tags.some((t) => t.toLowerCase().includes(lq))
      );
    });
  }, [models, q, task]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Models", url: "https://openodia.com/models" },
        ])}
      />
      {models.length > 0 && (
        <JsonLd
          data={itemListSchema(
            models.slice(0, 50).map((m) => ({
              name: m.id,
              url: m.url,
              description: TASK_LABEL[m.task] ?? m.task,
            })),
            "Odia AI Models",
            "Live registry of Odia-language models on Hugging Face.",
          )}
        />
      )}

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Registry</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia <span className="text-gradient">models</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Live from Hugging Face — every model tagged for Odia. LLMs, ASR, TTS, translation,
          embeddings, classifiers. Click any card to open it on Hugging Face.
        </p>
      </Reveal>

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
              setShownCount(PAGE_SIZE);
            }}
            placeholder="Search models, authors, tags… [/]"
            className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
          />
        </div>

        {tasks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip
              active={task === null}
              onClick={() => {
                setTask(null);
                setShownCount(PAGE_SIZE);
              }}
            >
              All ({models.length})
            </Chip>
            {tasks.map(([t, count]) => (
              <Chip
                key={t}
                active={task === t}
                onClick={() => {
                  setTask(task === t ? null : t);
                  setShownCount(PAGE_SIZE);
                }}
              >
                {TASK_LABEL[t] ?? t} ({count})
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
          <p className="col-span-full text-muted-foreground">No models matched.</p>
        ) : (
          filtered.slice(0, shownCount).map((m, i) => (
            <motion.a
              key={m.id}
              href={m.url}
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
                  {TASK_LABEL[m.task] ?? m.task}
                </span>
                <ExternalLink
                  size={14}
                  className="text-muted-foreground transition group-hover:text-neon"
                />
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{m.name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">@{m.author}</p>
              <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Download size={12} /> {formatCount(m.downloads)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} /> {formatCount(m.likes)}
                </span>
                {m.library && (
                  <span className="rounded-full border border-border px-2 py-0.5">{m.library}</span>
                )}
              </div>
            </motion.a>
          ))
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(shownCount, filtered.length)} of {filtered.length}
          </p>
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
