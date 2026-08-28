import { Download, ExternalLink, Heart } from "lucide-react";

/**
 * Gallery of this week's featured Hugging Face entries, shared by /models and
 * /datasets. Both routes hand it the same normalised shape, so one component
 * covers both. The picks themselves come from `lib/weekly-picks`.
 *
 * Hugging Face has no stable public card-image endpoint, so — unlike the GitHub
 * gallery on /tools — these cards are typographic: a gradient wash, the task
 * label, and the download/like counts.
 */

export type FeaturedItem = {
  id: string;
  name: string;
  author: string;
  url: string;
  /** Task/pipeline label, already prettified by the caller. */
  label: string;
  description?: string;
  downloads: number;
  likes: number;
};

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function FeaturedGallery({ hero, reels }: { hero: FeaturedItem[]; reels: FeaturedItem[] }) {
  if (hero.length === 0) return null;
  return (
    <>
      <SectionLabel tag="★ Featured" note="rotates every Monday" />
      <div className="grid gap-4 md:grid-cols-2">
        {hero.map((item) => (
          <HeroCard key={item.id} item={item} />
        ))}
      </div>
      {reels.length > 0 && (
        <>
          <SectionLabel tag="Also worth a look" />
          <div className="grid gap-4 sm:grid-cols-3">
            {reels.map((item) => (
              <ReelCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </>
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

function HeroCard({ item }: { item: FeaturedItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="hover-lift group relative flex min-h-[210px] items-end overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-neon/50"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_8%_0%,color-mix(in_oklab,var(--neon)_28%,transparent),transparent_58%),radial-gradient(110%_120%_at_100%_10%,color-mix(in_oklab,var(--magenta)_22%,transparent),transparent_60%)]"
      />
      <div className="relative w-full p-6">
        {/* Stands in for the org avatar /tools pulls from GitHub — Hugging Face
            has no equivalent URL we can hit without a second round trip. */}
        <span
          aria-hidden="true"
          className="mb-3 grid h-13 w-13 place-items-center rounded-2xl border border-foreground/20 bg-surface-2/60 font-display text-xl font-semibold uppercase text-foreground/70"
        >
          {item.author.slice(0, 1)}
        </span>
        <span className="block text-[10px] uppercase tracking-[0.14em] text-neon">
          {item.label}
        </span>
        <h3 className="mt-1 break-words font-display text-xl font-semibold leading-tight md:text-2xl">
          {item.name}
        </h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">@{item.author}</p>
        {item.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Download size={12} /> {formatCount(item.downloads)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart size={12} className="text-saffron" /> {formatCount(item.likes)}
          </span>
          <ExternalLink size={14} className="ml-auto transition group-hover:text-neon" />
        </div>
      </div>
    </a>
  );
}

function ReelCard({ item }: { item: FeaturedItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="hover-lift group relative flex min-h-[118px] flex-col justify-end gap-1 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition hover:border-neon/50"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5 bg-[radial-gradient(140%_160%_at_12%_0%,color-mix(in_oklab,var(--neon)_22%,transparent),transparent_65%)]"
      />
      <span className="relative text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {item.label}
      </span>
      <h3 className="relative break-words font-display text-sm font-semibold leading-tight">
        {item.name}
      </h3>
      <span className="relative flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Download size={11} /> {formatCount(item.downloads)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart size={11} className="text-saffron" /> {formatCount(item.likes)}
        </span>
      </span>
    </a>
  );
}
