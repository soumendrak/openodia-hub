import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, BadgeCheck, ExternalLink } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { groupBenchmarks, loadLeaderboard, type BenchmarkGroup } from "../lib/sources/leaderboard";

const SUBMIT_URL =
  "https://github.com/soumendrak/openodia-hub/issues/new?title=Leaderboard%20result&body=" +
  encodeURIComponent(
    [
      "Task (e.g. En→Or translation):",
      "Dataset + split (e.g. FLORES-200 devtest):",
      "Metric (e.g. chrF++):",
      "Score:",
      "System / model:",
      "Paper URL:",
      "Table or section the number comes from:",
      "Code / model URL (optional):",
    ].join("\n"),
  );

const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const board = await loadLeaderboard();
    return {
      groups: groupBenchmarks(board.rows),
      modelsScanned: board.modelsScanned,
      failed: false,
    };
  } catch (e) {
    console.error("leaderboard loader:", e);
    return { groups: [] as BenchmarkGroup[], modelsScanned: 0, failed: true };
  }
});

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Odia benchmarks · OpenOdia" },
      {
        name: "description",
        content:
          "Benchmark results for Odia NLP — task, dataset, and metric, with every score linked to the model card it was reported on.",
      },
      { property: "og:title", content: "Odia benchmarks · OpenOdia" },
      {
        property: "og:description",
        content: "Task × dataset × metric results for Odia language models.",
      },
    ],
  }),
  loader: () => getLeaderboard(),
  staleTime: 6 * 60 * 60 * 1000,
  component: LeaderboardPage,
});

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(2).replace(/\.00$/, "");
}

function BenchmarkTable({ group }: { group: BenchmarkGroup }) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-5 py-4">
        <h3 className="font-display text-lg font-semibold">{group.dataset}</h3>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {group.task}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {group.metric}
          {group.lowerIsBetter ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
          {group.lowerIsBetter ? "lower is better" : "higher is better"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-2 font-medium">#</th>
              <th className="px-5 py-2 font-medium">Model</th>
              <th className="px-5 py-2 font-medium">Split</th>
              <th className="px-5 py-2 text-right font-medium">{group.metric}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, i) => (
              <tr key={row.modelId} className="border-t border-border">
                <td className="px-5 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-5 py-2.5">
                  <Link to={row.permalink} className="break-all hover:text-neon">
                    {row.modelId}
                  </Link>
                  {row.verified && (
                    <BadgeCheck
                      size={13}
                      className="ml-1 inline text-neon"
                      aria-label="Score produced by Hugging Face's evaluation service"
                    />
                  )}
                </td>
                <td className="px-5 py-2.5 text-xs text-muted-foreground">{row.split || "—"}</td>
                <td className="px-5 py-2.5 text-right font-mono">{formatValue(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const { groups, modelsScanned, failed } = Route.useLoaderData();
  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Benchmarks", url: "https://openodia.com/leaderboard" },
        ])}
      />

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Benchmarks</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia <span className="text-gradient">results</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Task × dataset × metric for Odia. Papers with Code shut down in 2025 and nothing replaced
          it for Indic languages, so there has been nowhere to see these side by side.
        </p>
      </Reveal>

      {/* Where every number comes from, stated before the numbers. */}
      <Reveal delay={0.05} className="mt-8">
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How to read this</p>
          <ul className="mt-3 space-y-2">
            <li>
              Every score is <strong>self-reported</strong> in the{" "}
              <code className="rounded bg-surface-2 px-1">model-index</code> block of a Hugging Face
              model card, and the model name links to it. We do not re-run evaluations.
            </li>
            <li>
              A <BadgeCheck size={13} className="inline text-neon" /> marks a score produced by
              Hugging Face's own evaluation service rather than by the author.
            </li>
            <li>
              Scores are only comparable within one table — same task, same dataset, same metric,
              and ideally the same split. Check the split column before drawing conclusions.
            </li>
            <li>
              Results published in papers are <strong>not</strong> listed yet: transcribing a number
              out of a paper's table needs a human to check it, so those come in through the
              submission link below rather than being scraped.
            </li>
          </ul>
        </div>
      </Reveal>

      {failed ? (
        <p
          role="status"
          className="mt-8 rounded-2xl border border-saffron/40 bg-saffron/5 px-4 py-3 text-sm text-saffron"
        >
          Hugging Face is unreachable right now, so no results could be loaded.
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-border bg-surface p-6 text-muted-foreground">
          No Odia-specific results were found on the model cards scanned. If you know of one, send
          it in — the link is below.
        </p>
      ) : (
        <Reveal delay={0.1}>
          <p className="mt-10 text-xs text-muted-foreground">
            {rowCount} result{rowCount === 1 ? "" : "s"} across {groups.length} benchmark
            {groups.length === 1 ? "" : "s"}, from the {modelsScanned} most-downloaded Odia-tagged
            model cards.
          </p>
          {groups.map((g) => (
            <BenchmarkTable key={g.key} group={g} />
          ))}
        </Reveal>
      )}

      <Reveal delay={0.15} className="mt-12">
        <div className="rounded-2xl border border-neon/40 bg-neon/5 p-6">
          <h2 className="font-display text-2xl font-semibold">Know a result that belongs here?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Paper results, WAT submissions, and evaluations that never made it onto a model card are
            all welcome. The form asks for the paper and the exact table the number comes from, so
            anyone can check it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={SUBMIT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Submit a result <ExternalLink size={14} />
            </a>
            <Link
              to="/contribute"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition hover:border-neon hover:text-neon"
            >
              Other ways to contribute
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
