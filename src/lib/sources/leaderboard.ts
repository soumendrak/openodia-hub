/**
 * Odia benchmark results.
 *
 * Rows come from the `model-index` block that Hugging Face model cards carry —
 * the same structured field HF's own leaderboards read. Only results whose
 * dataset config or name identifies Odia are kept, so a multilingual model
 * contributes its Odia rows and nothing else.
 *
 * Every row is *self-reported by the model's author* and links back to the card
 * it came from. Nothing here is re-run or re-scored by us, and nothing is
 * transcribed from a paper by hand — results from papers need a human to check
 * the table they came from, so they arrive through the submission path instead.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson, UpstreamUnavailableError } from "./cache";

export type LeaderboardRow = {
  modelId: string;
  modelUrl: string;
  permalink: string;
  task: string;
  dataset: string;
  config: string;
  split: string;
  metric: string;
  value: number;
  /** HF's own flag: whether the score was produced by their evaluation service. */
  verified: boolean;
};

export type Leaderboard = {
  rows: LeaderboardRow[];
  /** How many model cards were read to build this. */
  modelsScanned: number;
};

const BASE =
  "https://huggingface.co/api/models?filter=or&limit=100&sort=downloads&direction=-1&expand[]=cardData";
/**
 * Cards carrying benchmark results are overwhelmingly the widely-downloaded
 * models, and each page of expanded cards is several MB, so the scan stops
 * after the top few hundred. The page says how many were read.
 */
const MAX_PAGES = 3;
const TTL_MS = 6 * 60 * 60 * 1000;

type HFResult = {
  task?: { type?: string; name?: string };
  dataset?: { name?: string; type?: string; config?: string; split?: string };
  metrics?: { type?: string; name?: string; value?: unknown; verified?: boolean }[];
};

type HFListed = {
  id: string;
  cardData?: { "model-index"?: { results?: HFResult[] }[] };
};

/** ISO codes and names Odia appears under in dataset configs. */
const ODIA_CODES = new Set(["or", "ory", "ori", "odia", "oriya", "orya"]);

export function isOdiaResult(name: string | undefined, config: string | undefined): boolean {
  const tokens = new Set(
    (config ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean),
  );
  for (const t of tokens) if (ODIA_CODES.has(t)) return true;
  return /odia|oriya|ory_orya/i.test(name ?? "");
}

/** Lower is better for these, so the table sorts them the other way. */
const LOWER_IS_BETTER = /^(wer|cer|per|loss|perplexity|ppl|mae|rmse)$/i;

export function isLowerBetter(metric: string): boolean {
  return LOWER_IS_BETTER.test(metric.trim());
}

function prettyTask(task: string): string {
  return task
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function nextPage(response: Response): string | null {
  const link = response.headers.get("link");
  const m = link ? /<([^>]+)>;\s*rel="next"/.exec(link) : null;
  return m ? m[1] : null;
}

export async function loadLeaderboard(): Promise<Leaderboard> {
  return cachedJson("leaderboard", TTL_MS, async () => {
    const rows: LeaderboardRow[] = [];
    let scanned = 0;
    let next: string | null = BASE;

    for (let page = 0; next && page < MAX_PAGES; page++) {
      const r: Response = await fetchWithTimeout(
        next,
        { headers: { "User-Agent": "openodia.com" } },
        20000,
      );
      if (!r.ok) throw new UpstreamUnavailableError(`hf_leaderboard_${r.status}`);
      const models = (await r.json()) as HFListed[];
      scanned += models.length;

      for (const model of models) {
        for (const entry of model.cardData?.["model-index"] ?? []) {
          for (const result of entry.results ?? []) {
            const ds = result.dataset ?? {};
            if (!isOdiaResult(ds.name, ds.config)) continue;
            for (const metric of result.metrics ?? []) {
              const value = typeof metric.value === "number" ? metric.value : Number(metric.value);
              if (!Number.isFinite(value)) continue;
              rows.push({
                modelId: model.id,
                modelUrl: `https://huggingface.co/${model.id}`,
                permalink: `/r/model/${model.id}`,
                task: prettyTask(result.task?.type ?? result.task?.name ?? "Other"),
                dataset: ds.name ?? ds.type ?? "Unnamed dataset",
                config: ds.config ?? "",
                split: ds.split ?? "",
                metric: metric.type ?? metric.name ?? "score",
                value,
                verified: metric.verified === true,
              });
            }
          }
        }
      }
      next = nextPage(r);
    }

    return { rows, modelsScanned: scanned };
  });
}

export type BenchmarkGroup = {
  key: string;
  task: string;
  dataset: string;
  metric: string;
  lowerIsBetter: boolean;
  rows: LeaderboardRow[];
};

/**
 * One table per `<task, dataset, metric>` — the Papers-with-Code shape — with
 * each model's best score for that combination.
 */
export function groupBenchmarks(rows: LeaderboardRow[]): BenchmarkGroup[] {
  const groups = new Map<string, BenchmarkGroup>();

  for (const row of rows) {
    const key = `${row.task}|${row.dataset}|${row.metric}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        task: row.task,
        dataset: row.dataset,
        metric: row.metric,
        lowerIsBetter: isLowerBetter(row.metric),
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  for (const group of groups.values()) {
    // Keep one score per model — the best it reports for this combination.
    const best = new Map<string, LeaderboardRow>();
    for (const row of group.rows) {
      const held = best.get(row.modelId);
      if (!held || (group.lowerIsBetter ? row.value < held.value : row.value > held.value)) {
        best.set(row.modelId, row);
      }
    }
    group.rows = [...best.values()].sort((a, b) =>
      group.lowerIsBetter ? a.value - b.value : b.value - a.value,
    );
  }

  return [...groups.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.task.localeCompare(b.task),
  );
}
