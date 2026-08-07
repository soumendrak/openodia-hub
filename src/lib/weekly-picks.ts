/**
 * Weekly featured-repo rotation for /tools.
 *
 * The picks are a pure function of the date: the ISO year+week is the PRNG
 * seed, so every visitor sees the same five repos all week and the set rotates
 * itself every Monday with no cron job, database, or rebuild.
 *
 * All date maths runs in UTC. Deriving the week from local time would let a
 * UTC server and an IST browser land on different weeks on Sunday evenings,
 * which SSR would surface as a hydration mismatch.
 */

export type WeekStamp = { year: number; week: number };

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(date: Date): WeekStamp {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday (0) counts as day 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // hop to this week's Thursday
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7),
  };
}

/** Stable seed that changes exactly once a week, at Monday 00:00 UTC. */
export function weekSeed(date: Date): number {
  const { year, week } = isoWeek(date);
  return year * 100 + week;
}

/** mulberry32 — small, fast, well-distributed. Seeded so output is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fisher-Yates against a seeded PRNG: same seed in, same order out. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const a = items.slice();
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const MIN_STARS = 5;
/** Hugging Face equivalent of MIN_STARS — likes are the popularity signal there. */
export const MIN_LIKES = 3;
const HERO_COUNT = 2;
const REEL_COUNT = 3;

/**
 * Draw this week's featured set from any scored pool: `hero` gets the two
 * highest-scoring items of the draw, `reels` gets the rest. Returns empty
 * arrays when the pool is too small to fill the hero row, so callers can skip
 * the section entirely.
 */
export function pickWeeklyBy<T>(
  items: readonly T[],
  date: Date,
  score: (item: T) => number,
  minScore: number,
): { hero: T[]; reels: T[] } {
  const pool = items.filter((i) => score(i) >= minScore);
  if (pool.length < HERO_COUNT) return { hero: [], reels: [] };

  const drawn = seededShuffle(pool, weekSeed(date))
    .slice(0, HERO_COUNT + REEL_COUNT)
    .sort((a, b) => score(b) - score(a));

  return { hero: drawn.slice(0, HERO_COUNT), reels: drawn.slice(HERO_COUNT) };
}

/** Repo flavour of {@link pickWeeklyBy}, scored on GitHub stars. */
export function pickWeeklyFeatured<T extends { stargazers_count: number }>(
  repos: readonly T[],
  date: Date,
  minStars: number = MIN_STARS,
): { hero: T[]; reels: T[] } {
  return pickWeeklyBy(repos, date, (r) => r.stargazers_count, minStars);
}
