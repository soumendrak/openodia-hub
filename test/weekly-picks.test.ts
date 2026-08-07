import { describe, it, expect } from "vitest";
import {
  isoWeek,
  weekSeed,
  seededShuffle,
  pickWeeklyFeatured,
  MIN_STARS,
} from "../src/lib/weekly-picks";

type R = { full_name: string; stargazers_count: number };

const pool: R[] = [
  ["shantipriyap/Odia-NLP-Resource-Catalog", 33],
  ["OdiaGenAI/GenerativeAI_and_LLM_Odia", 31],
  ["sovopr/sovogpt", 20],
  ["goru001/nlp-for-odia", 14],
  ["OdiaWikimedia/Converter", 12],
  ["OdiaNLP/NMT", 9],
  ["jyotishankar04/odialang", 8],
  ["soumendrak/openodia", 7],
  ["Deeptiman/Alphabet-Learning-Android-Application", 7],
  ["odisha-ml/Awesome-Odia-AI", 7],
  ["gyan111/gyan111.github.io", 6],
  ["HimanshuMohanty-Git24/OdiaLingua", 6],
  ["imsbg/Ganita-Bingya-App", 6],
  ["odisha-ml/OdiaInMLWeb", 6],
  ["OdiaGenAI/Olive_Odia_ASR", 6],
  ["nsoum/odia-tex", 5],
  ["UniversalDependencies/UD_Odia-ODTB", 5],
  ["OdiaWikimedia/English-Odia", 5],
  ["OdiaNLP/dictionary", 5],
  // below the cutoff — must never be featured
  ["Sameetpatro/odlang", 4],
  ["notofonts/oriya", 3],
].map(([full_name, stargazers_count]) => ({
  full_name: full_name as string,
  stargazers_count: stargazers_count as number,
}));

const names = (rs: R[]) => rs.map((r) => r.full_name).join();
const allOf = ({ hero, reels }: { hero: R[]; reels: R[] }) => [...hero, ...reels];

describe("isoWeek", () => {
  it.each([
    // [date, year, week]
    ["2026-01-01", 2026, 1], // Thursday — week 1 of its own year
    ["2026-08-03", 2026, 32], // a plain Monday
    ["2026-08-09", 2026, 32], // the Sunday of that same week
    ["2026-08-10", 2026, 33], // next Monday rolls over
    ["2027-01-01", 2026, 53], // Friday belongs to 2026's week 53
    ["2024-12-30", 2025, 1], // Monday belongs to 2025's week 1
  ])("%s → %i-W%i", (iso, year, week) => {
    expect(isoWeek(new Date(`${iso}T00:00:00Z`))).toEqual({ year, week });
  });

  it("is stable across a whole week and flips on Monday", () => {
    const mon = weekSeed(new Date("2026-08-03T00:00:00Z"));
    const sun = weekSeed(new Date("2026-08-09T23:59:59Z"));
    const nextMon = weekSeed(new Date("2026-08-10T00:00:00Z"));
    expect(sun).toBe(mon);
    expect(nextMon).not.toBe(mon);
  });

  it("does not depend on the wall-clock timezone", () => {
    // Same instant, two representations. A local-time implementation would
    // disagree here and desync SSR from the browser.
    const a = weekSeed(new Date("2026-08-09T23:00:00Z"));
    const b = weekSeed(new Date("2026-08-10T04:30:00+05:30"));
    expect(a).toBe(b);
  });
});

describe("seededShuffle", () => {
  it("is deterministic for a given seed", () => {
    expect(seededShuffle(pool, 202632)).toEqual(seededShuffle(pool, 202632));
  });

  it("does not mutate the input", () => {
    const before = [...pool];
    seededShuffle(pool, 1);
    expect(pool).toEqual(before);
  });

  it("is a permutation — nothing lost, nothing duplicated", () => {
    const out = seededShuffle(pool, 202632);
    expect(out).toHaveLength(pool.length);
    expect(new Set(out)).toEqual(new Set(pool));
  });

  it("handles empty and single-item inputs", () => {
    expect(seededShuffle([], 1)).toEqual([]);
    expect(seededShuffle(["only"], 1)).toEqual(["only"]);
  });
});

describe("pickWeeklyFeatured", () => {
  const at = (iso: string) => pickWeeklyFeatured(pool, new Date(`${iso}T00:00:00Z`));

  it("fills 2 hero + 3 reel slots", () => {
    const { hero, reels } = at("2026-08-03");
    expect(hero).toHaveLength(2);
    expect(reels).toHaveLength(3);
  });

  it("returns the same picks all week, different picks next week", () => {
    expect(names(allOf(at("2026-08-09")))).toBe(names(allOf(at("2026-08-03"))));
    expect(names(allOf(at("2026-08-10")))).not.toBe(names(allOf(at("2026-08-03"))));
  });

  it("never features a repo below the star cutoff", () => {
    for (let w = 1; w <= 53; w++) {
      const d = new Date(Date.UTC(2026, 0, 1 + (w - 1) * 7));
      for (const r of allOf(pickWeeklyFeatured(pool, d))) {
        expect(r.stargazers_count).toBeGreaterThanOrEqual(MIN_STARS);
      }
    }
  });

  it("never repeats a repo within one week's picks", () => {
    for (let w = 1; w <= 53; w++) {
      const d = new Date(Date.UTC(2026, 0, 1 + (w - 1) * 7));
      const picks = allOf(pickWeeklyFeatured(pool, d));
      expect(new Set(picks.map((r) => r.full_name)).size).toBe(picks.length);
    }
  });

  it("gives the hero slots the highest-starred repos of the draw", () => {
    for (let w = 1; w <= 53; w++) {
      const d = new Date(Date.UTC(2026, 0, 1 + (w - 1) * 7));
      const { hero, reels } = pickWeeklyFeatured(pool, d);
      const floor = Math.min(...hero.map((r) => r.stargazers_count));
      for (const r of reels) expect(r.stargazers_count).toBeLessThanOrEqual(floor);
    }
  });

  it("rotates rather than showing one fixed set", () => {
    const seen = new Set<string>();
    for (let w = 1; w <= 8; w++) {
      const d = new Date(Date.UTC(2026, 0, 1 + (w - 1) * 7));
      for (const r of allOf(pickWeeklyFeatured(pool, d))) seen.add(r.full_name);
    }
    // 8 weeks x 5 slots over a 19-repo pool should surface most of it
    expect(seen.size).toBeGreaterThan(10);
  });

  it("degrades to an empty section when the pool cannot fill the hero row", () => {
    const date = new Date("2026-08-03T00:00:00Z");
    expect(pickWeeklyFeatured([], date)).toEqual({ hero: [], reels: [] });
    expect(pickWeeklyFeatured(pool.slice(0, 1), date)).toEqual({ hero: [], reels: [] });
  });

  it("still renders when the pool is smaller than all five slots", () => {
    const { hero, reels } = pickWeeklyFeatured(pool.slice(0, 3), new Date("2026-08-03T00:00:00Z"));
    expect(hero).toHaveLength(2);
    expect(reels).toHaveLength(1);
  });
});
