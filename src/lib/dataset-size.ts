/**
 * Hugging Face `size_categories` buckets.
 *
 * The vocabulary runs "n<1K", "1K<n<10K", … "100B<n<1T", "n>1T", so both the
 * label and the sort have to read the bucket rather than the raw string.
 */

const MULTIPLIER: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/** "10K<n<100K" → "10K < n < 100K". */
export function prettySize(bucket: string): string {
  return bucket.replace(/</g, " < ").replace(/>/g, " > ").replace(/\s+/g, " ").trim();
}

/**
 * Sort key: the bucket's upper bound. The open-ended top bucket ("n>1T") has
 * no upper bound, so it sorts last.
 */
export function sizeRank(bucket: string): number {
  if (!bucket.includes("<")) return Number.MAX_SAFE_INTEGER;
  const upper = bucket.split("<").pop() ?? "";
  const m = /(\d+(?:\.\d+)?)\s*([KMBT]?)/i.exec(upper);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * (MULTIPLIER[m[2].toUpperCase()] ?? 1);
}
