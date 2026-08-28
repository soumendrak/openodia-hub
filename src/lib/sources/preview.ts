/**
 * First rows of a Hugging Face dataset, via the public dataset-viewer API.
 *
 * "Inspect before download" is the affordance researchers reach for first.
 * The viewer doesn't cover every dataset (gated, script-based, or too large),
 * and it says why — so the reason is passed through rather than swallowed.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { cachedJson } from "./cache";

const BASE = "https://datasets-server.huggingface.co";
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ROWS = 5;
const MAX_CELL_CHARS = 300;

export type DatasetPreview =
  | { available: true; config: string; split: string; columns: string[]; rows: string[][] }
  | { available: false; reason: string };

type SplitsResponse = {
  splits?: { config: string; split: string }[];
  error?: string;
};

type FirstRowsResponse = {
  features?: { name: string }[];
  rows?: { row: Record<string, unknown> }[];
  error?: string;
};

/**
 * Multi-language datasets expose one config per language; show the Odia one.
 * `or` is the ISO 639-1 code, and configs name it either bare ("or") or
 * suffixed ("20231101.or", "odia").
 */
function pickConfig(splits: { config: string; split: string }[]): {
  config: string;
  split: string;
} {
  const odia = splits.find((s) => /(^|[._-])(or|ory|odia|oriya)([._-]|$)/i.test(s.config));
  const preferred = odia ?? splits[0];
  // Prefer a train split within the chosen config when one exists.
  return splits.find((s) => s.config === preferred.config && s.split === "train") ?? preferred;
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS - 1)}…` : text;
}

export async function loadDatasetPreview(datasetId: string): Promise<DatasetPreview> {
  return cachedJson(`preview:${datasetId}`, TTL_MS, async () => {
    const id = encodeURIComponent(datasetId);

    const splitsRes = await fetchWithTimeout(`${BASE}/splits?dataset=${id}`, {
      headers: { "User-Agent": "openodia.com" },
    });
    const splitsBody = (await splitsRes.json().catch(() => ({}))) as SplitsResponse;
    if (!splitsRes.ok || !splitsBody.splits?.length) {
      return {
        available: false as const,
        reason: splitsBody.error ?? "The Hugging Face dataset viewer has no preview for this one.",
      };
    }

    const { config, split } = pickConfig(splitsBody.splits);
    const rowsRes = await fetchWithTimeout(
      `${BASE}/first-rows?dataset=${id}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}`,
      { headers: { "User-Agent": "openodia.com" } },
    );
    const rowsBody = (await rowsRes.json().catch(() => ({}))) as FirstRowsResponse;
    if (!rowsRes.ok || !rowsBody.rows?.length) {
      return {
        available: false as const,
        reason: rowsBody.error ?? "The dataset viewer returned no rows.",
      };
    }

    const columns = (rowsBody.features ?? []).map((f) => f.name);
    return {
      available: true as const,
      config,
      split,
      columns,
      rows: rowsBody.rows.slice(0, MAX_ROWS).map((r) => columns.map((c) => renderCell(r.row[c]))),
    };
  });
}
