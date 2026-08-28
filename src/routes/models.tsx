import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Heart, Download, ChevronDown } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { FeaturedGallery, formatCount } from "../components/FeaturedGallery";
import { ActiveFilterBar, EmptyResults, FacetGroup, ResultCount } from "../components/Facets";
import {
  computeFacets,
  toggleSelection,
  type ActiveFilter,
  type FacetDef,
  type Selection,
} from "../lib/facets";
import { ResourceMeta } from "../components/ResourceMeta";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";
import { normalizeSpdx } from "../lib/license";
import { refToPath } from "../lib/resource-id";
import { MIN_LIKES, pickWeeklyBy } from "../lib/weekly-picks";
import { loadModels, type Model } from "../lib/sources/huggingface";

/**
 * Runs on the server during SSR and over RPC on client navigation, so the
 * registry is in the server HTML instead of arriving after hydration.
 */
const getModels = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const page = await loadModels();
    return { models: page.items, truncated: page.truncated, failed: false };
  } catch (e) {
    console.error("models loader:", e);
    return { models: [] as Model[], truncated: false, failed: true };
  }
});

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Models · OpenOdia" },
      {
        name: "description",
        content:
          "Live registry of Odia-language AI models on Hugging Face — LLMs, ASR, TTS, translation, embeddings, and more, with licenses and citations.",
      },
      { property: "og:title", content: "Models · OpenOdia" },
      {
        property: "og:description",
        content: "Live registry of Odia-language AI models on Hugging Face.",
      },
    ],
  }),
  loader: () => getModels(),
  staleTime: 60 * 60 * 1000,
  component: ModelsPage,
});

const TASK_LABEL: Record<string, string> = {
  "text-generation": "Text generation",
  "text-classification": "Text classification",
  "token-classification": "Token classification",
  translation: "Translation",
  "automatic-speech-recognition": "Speech recognition",
  "text-to-speech": "Text-to-speech",
  "text-to-audio": "Text-to-audio",
  "audio-classification": "Audio classification",
  "feature-extraction": "Embeddings",
  "sentence-similarity": "Sentence similarity",
  "fill-mask": "Fill mask",
  summarization: "Summarization",
  "question-answering": "Question answering",
  "image-to-text": "Image-to-text",
  other: "Other",
};

/** HF pipeline tags are kebab-case; humanise the ones the table doesn't name. */
function taskLabel(task: string): string {
  return TASK_LABEL[task] ?? task.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const PAGE_SIZE = 30;

const FACETS: FacetDef<Model>[] = [
  { key: "task", title: "Task", values: (m) => [m.task], label: taskLabel },
  { key: "license", title: "License", values: (m) => [normalizeSpdx(m.license)] },
];

function ModelsPage() {
  const { models, truncated, failed } = Route.useLoaderData();
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

  // Five models featured above the registry, drawn from a seeded shuffle keyed
  // on the ISO week — same set for every visitor all week, rotates itself every
  // Monday. Deterministic, so SSR and the client agree. See lib/weekly-picks.
  const featured = useMemo(() => {
    const { hero, reels } = pickWeeklyBy(models, new Date(), (m) => m.likes, MIN_LIKES);
    const toItem = (m: Model) => ({ ...m, label: taskLabel(m.task) });
    return { hero: hero.map(toItem), reels: reels.map(toItem) };
  }, [models]);

  // Counts are cross-filtered here: each facet is counted against the other
  // facet's selection, so a number is always what selecting it returns.
  const {
    filtered,
    options,
    active: activeFilters,
  } = useMemo(() => {
    const lq = q.trim().toLowerCase();
    const search = (m: Model) =>
      !lq ||
      m.id.toLowerCase().includes(lq) ||
      m.author.toLowerCase().includes(lq) ||
      m.task.toLowerCase().includes(lq) ||
      m.tags.some((t) => t.toLowerCase().includes(lq));
    return computeFacets(models, FACETS, selected, search);
  }, [models, q, selected]);

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
              description: taskLabel(m.task),
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
          embeddings, classifiers. Each card carries its license and a ready-to-paste citation.
        </p>
      </Reveal>

      {failed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          Hugging Face is unreachable right now, so the registry is empty below. Reload in a minute.
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
            placeholder="Search models, authors, tags… [/]"
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
          <EmptyResults query={q} filters={activeFilters} onClearAll={clearAll} noun="models" />
        ) : (
          filtered.slice(0, shownCount).map((m, i) => (
            <motion.div
              key={m.id}
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
              {/* Internal permalink: the detail page is what a researcher can
                  cite and link to. Upstream is one click on from there. */}
              <Link
                to={refToPath({ kind: "model", id: m.id })}
                className="flex flex-1 flex-col p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {taskLabel(m.task)}
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
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {m.library}
                    </span>
                  )}
                </div>
              </Link>
              <ResourceMeta
                license={normalizeSpdx(m.license)}
                entry={{
                  name: m.name,
                  author: m.author,
                  url: m.url,
                  createdAt: m.createdAt,
                }}
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
            noun="models"
          />
          {truncated && (
            <p className="text-[11px] text-muted-foreground">
              Hugging Face has more Odia-tagged models than this page loads; the registry stops at
              the first {models.length}.
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
