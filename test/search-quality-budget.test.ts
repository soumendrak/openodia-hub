import { describe, expect, it } from "vitest";
import { searchDocuments, type SearchDocument } from "../src/lib/search";

/**
 * These are regression budgets, not production SLOs. The live-browser review
 * records endpoint timings separately; this gate catches accidental algorithm
 * or payload explosions deterministically in CI.
 */
const SEARCH_CORPUS_SIZE = 5_000;
// CI workers run tests concurrently; 250 ms leaves scheduling headroom while
// the live endpoint has the tighter 150 ms budget recorded in the quality doc.
const WARM_P95_BUDGET_MS = 250;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_RESULTS = 50;

const documents: SearchDocument[] = Array.from({ length: SEARCH_CORPUS_SIZE }, (_, index) => ({
  id: `model:${index}`,
  kind: "model",
  title: index === SEARCH_CORPUS_SIZE - 1 ? "Target Odia Atlas" : `Odia resource ${index}`,
  summary: `Curated Odia language resource number ${index}.`,
  keywords: ["odia", "language", index % 2 === 0 ? "text" : "speech"],
  href: `/r/model/openodia/resource-${index}`,
  externalHref: `https://example.com/resource-${index}`,
  source: "fixture",
}));

describe("search quality budgets", () => {
  it("keeps warm ranking latency and the bounded response payload within budget", () => {
    searchDocuments(documents, "target odia atlas", { limit: MAX_RESULTS });
    const durations: number[] = [];
    let results = searchDocuments(documents, "odia", { limit: MAX_RESULTS });

    for (let index = 0; index < 20; index++) {
      const started = performance.now();
      results = searchDocuments(documents, "odia", { limit: MAX_RESULTS });
      durations.push(performance.now() - started);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    const responseBytes = new TextEncoder().encode(JSON.stringify({ results })).byteLength;
    expect(results).toHaveLength(MAX_RESULTS);
    expect(p95).toBeLessThan(WARM_P95_BUDGET_MS);
    expect(responseBytes).toBeLessThan(MAX_RESPONSE_BYTES);
  });
});
