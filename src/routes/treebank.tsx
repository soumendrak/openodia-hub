import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { Chip } from "../components/Facets";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import {
  loadTreebank,
  searchTreebank,
  TREEBANK,
  type TreebankResult,
} from "../lib/sources/treebank";
import { pageHead } from "../lib/seo";

const LIMIT = 25;

const EMPTY: TreebankResult = {
  hits: [],
  total: 0,
  uposCounts: [],
  deprelCounts: [],
  sentenceCount: 0,
  tokenCount: 0,
};

/**
 * Search runs on the server: the treebank is 700 KB of CoNLL-U and there is no
 * reason to ship it to every visitor to filter it in the browser.
 */
const runSearch = createServerFn({ method: "GET" })
  .inputValidator((q: { q: string; upos: string; deprel: string }) => q)
  .handler(async ({ data }): Promise<{ result: TreebankResult; failed: boolean }> => {
    try {
      const corpus = await loadTreebank();
      return { result: searchTreebank(corpus, { ...data, limit: LIMIT }), failed: false };
    } catch (e) {
      console.error("treebank loader:", e);
      return { result: EMPTY, failed: true };
    }
  });

// Optional so a plain <Link to="/treebank"> needs no search params; the
// validator fills the defaults in.
type TreebankSearch = { q?: string; upos?: string; deprel?: string };

export const Route = createFileRoute("/treebank")({
  // Query in the URL, so a concordance result can be linked to and cited.
  validateSearch: (search: Record<string, unknown>): TreebankSearch => {
    // Empty values are dropped rather than normalised to "", so /treebank
    // doesn't bounce through a 307 to "?q=&upos=&deprel=".
    const str = (v: unknown, max: number) =>
      typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
    return { q: str(search.q, 80), upos: str(search.upos, 20), deprel: str(search.deprel, 20) };
  },
  loaderDeps: ({ search }) => ({
    q: search.q ?? "",
    upos: search.upos ?? "",
    deprel: search.deprel ?? "",
  }),
  loader: ({ deps }) => runSearch({ data: deps }),
  head: () =>
    pageHead({
      path: "treebank",
      title: "Treebank search · OpenOdia",
      description:
        "Search the UD_Odia-ODTB Universal Dependencies treebank — concordance by word form, part of speech, and dependency relation, with English glosses.",
      ogDescription: "Concordance search over the Odia Universal Dependencies treebank.",
    }),
  component: TreebankPage,
});

function TreebankPage() {
  const { result, failed } = Route.useLoaderData();
  const raw = Route.useSearch();
  const search = { q: raw.q ?? "", upos: raw.upos ?? "", deprel: raw.deprel ?? "" };
  const navigate = Route.useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(inputRef);

  const update = (patch: TreebankSearch) =>
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch };
        return {
          q: next.q || undefined,
          upos: next.upos || undefined,
          deprel: next.deprel || undefined,
        };
      },
      replace: true,
    });

  const active = Boolean(search.q || search.upos || search.deprel);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Treebank", url: "https://openodia.com/treebank" },
        ])}
      />

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Corpus</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia <span className="text-gradient">treebank</span> search.
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Concordance over{" "}
          <a
            href={TREEBANK.repo}
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            {TREEBANK.name} <ExternalLink size={12} className="inline" />
          </a>
          , the Odia Universal Dependencies treebank — {result.sentenceCount} sentences,{" "}
          {result.tokenCount} tokens, each with part of speech, morphological features, and a
          dependency relation. Search by word form, transliteration, or feature; narrow by tag. The
          query lives in the URL, so a result is linkable.
        </p>
      </Reveal>

      {failed && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          The treebank file is unreachable right now. Reload in a minute.
        </p>
      )}

      <Reveal delay={0.1} className="mt-10">
        <div className="relative max-w-xl">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            defaultValue={search.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="ଓଡ଼ିଆ word, transliteration, or feature (e.g. Case=Loc) … [/]"
            className="w-full rounded-full border border-border bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-neon"
          />
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Part of speech
            </span>
            <Chip active={!search.upos} onClick={() => update({ upos: "" })}>
              Any
            </Chip>
            {result.uposCounts.map(([tag, count]) => (
              <Chip
                key={tag}
                active={search.upos === tag}
                onClick={() => update({ upos: search.upos === tag ? "" : tag })}
              >
                {tag} ({count})
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Relation
            </span>
            <Chip active={!search.deprel} onClick={() => update({ deprel: "" })}>
              Any
            </Chip>
            {result.deprelCounts.map(([tag, count]) => (
              <Chip
                key={tag}
                active={search.deprel === tag}
                onClick={() => update({ deprel: search.deprel === tag ? "" : tag })}
              >
                {tag} ({count})
              </Chip>
            ))}
          </div>
        </div>
      </Reveal>

      <p className="mt-6 text-xs text-muted-foreground" role="status" aria-live="polite">
        {active
          ? `${result.total} matching sentence${result.total === 1 ? "" : "s"}`
          : `${result.sentenceCount} sentences`}
        {result.total > LIMIT && ` · showing the first ${LIMIT}`}
      </p>

      <div className="mt-4 space-y-4">
        {result.hits.length === 0 && !failed && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted-foreground">
            Nothing matched. Try a shorter form, or clear the tag filters.
          </div>
        )}
        {result.hits.map(({ sentence, matches }) => {
          const hit = new Set(matches);
          return (
            <article
              key={sentence.sentId}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <p
                lang="or"
                className="font-display text-lg leading-loose"
                style={{ letterSpacing: "normal" }}
              >
                {sentence.tokens.map((t, i) => (
                  <span
                    key={t.id}
                    title={`${t.upos} · ${t.deprel}${t.feats ? ` · ${t.feats}` : ""}`}
                    className={
                      hit.has(i) ? "rounded bg-neon/20 px-0.5 text-neon" : "text-foreground/90"
                    }
                  >
                    {t.form}{" "}
                  </span>
                ))}
              </p>
              {sentence.textEn && (
                <p className="mt-2 text-sm text-muted-foreground">{sentence.textEn}</p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer list-none text-[10px] uppercase tracking-wider text-muted-foreground hover:text-neon [&::-webkit-details-marker]:hidden">
                  {sentence.sentId} · show analysis
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-medium">#</th>
                        <th className="py-1 pr-3 font-medium">Form</th>
                        <th className="py-1 pr-3 font-medium">Translit</th>
                        <th className="py-1 pr-3 font-medium">UPOS</th>
                        <th className="py-1 pr-3 font-medium">Head</th>
                        <th className="py-1 pr-3 font-medium">Relation</th>
                        <th className="py-1 font-medium">Features</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentence.tokens.map((t, i) => (
                        <tr
                          key={t.id}
                          className={`border-t border-border ${hit.has(i) ? "text-neon" : ""}`}
                        >
                          <td className="py-1 pr-3 text-muted-foreground">{t.id}</td>
                          <td className="py-1 pr-3" lang="or">
                            {t.form}
                          </td>
                          <td className="py-1 pr-3 text-muted-foreground">{t.translit}</td>
                          <td className="py-1 pr-3">{t.upos}</td>
                          <td className="py-1 pr-3 text-muted-foreground">{t.head || "—"}</td>
                          <td className="py-1 pr-3">{t.deprel}</td>
                          <td className="py-1 text-muted-foreground">{t.feats || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          );
        })}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        {TREEBANK.name} is released under {TREEBANK.license} by the Universal Dependencies project;
        this page only searches it. Cite the treebank, not this page.
      </p>
    </div>
  );
}
