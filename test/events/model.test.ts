import { describe, expect, expectTypeOf, it } from "vitest";
import {
  applyCorrection,
  dates,
  ExactDates,
  httpsUrl,
  isoDay,
  isoInstant,
  join,
  notices,
  noticeText,
  text,
  timestamp,
  type CanonicalEvent,
  type Correction,
  type Dates,
  type Field,
  type Lifecycle,
  type Notice,
  type Registration,
  type Result,
} from "../../src/events/model";

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`unexpected ${String(result.error)}`);
  return result.value;
}

const day = (value: string) => unwrap(isoDay(value));
const instant = (value: string) => unwrap(isoInstant(value));
const stamp = (value: string) => unwrap(timestamp(value));
const VERIFIED = stamp("2026-01-01T00:00:00Z");
const VERIFIED_DAY = stamp("2026-03-01");
const MARCH_1 = day("2026-03-01");
const MARCH_5 = day("2026-03-05");
const APRIL_10 = day("2026-04-10");
const DAYS = [MARCH_1, day("2026-03-02"), MARCH_5, APRIL_10];
const JAN = instant("2026-01-01T00:00:00.000Z");
const FEB = instant("2026-02-01T00:00:00.000Z");
const MAR = instant("2026-03-01T00:00:00.000Z");
const TIMES = [JAN, FEB, MAR];
const EVIDENCE = unwrap(httpsUrl("https://x.org/ev"));
const A = unwrap(text("A"));
const B = unwrap(text("B"));
const C = unwrap(text("C"));
const TEXTS = [A, B, C];
const LATE_2025: Dates = { kind: "approximate", label: unwrap(text("Oct–Nov 2025")) };

function random(seed: number) {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(next() * items.length)];
    if (item === undefined) throw new Error("pick from an empty list");
    return item;
  };
  return { next, pick };
}

type Random = ReturnType<typeof random>;

function field<T>(rng: Random, values: readonly T[]): Field<T> {
  if (rng.next() < 0.45)
    return { kind: "upstream", value: rng.pick(values), seen: rng.pick(TIMES) };
  return { kind: "reviewed", value: rng.pick(values), at: rng.pick(TIMES), evidence: EVIDENCE };
}

function ranges(rng: Random) {
  const attempts = DAYS.map(() => {
    const start = rng.pick(DAYS);
    const end = rng.pick(DAYS);
    const previous = rng.next() < 0.5 ? null : rng.pick(DAYS);
    return { start, end, previous, result: dates({ start, end, previous }) };
  });
  const day = rng.pick(DAYS);
  const built: Dates[] = [unwrap(dates({ start: day, end: day, previous: null })), LATE_2025];
  for (const { result } of attempts) if (result.ok) built.push(result.value);
  return { attempts, built };
}

const OFFICIAL = unwrap(httpsUrl("https://x.org/official"));
const checked = { evidenceUrl: OFFICIAL, verifiedAt: VERIFIED };
const range = (
  start: typeof MARCH_1,
  end: typeof MARCH_1,
  previous: typeof MARCH_1 | null = null,
) => unwrap(dates({ start, end, previous }));
const LIFECYCLES: (Lifecycle | null)[] = [
  null,
  { kind: "scheduled", ...checked },
  { kind: "postponed", ...checked },
  { kind: "rescheduled", ...checked },
  { kind: "cancelled", ...checked },
];
const notice: Notice = {
  kind: "venue",
  text: unwrap(noticeText("Moved.")),
  evidenceUrl: EVIDENCE,
  verifiedAt: VERIFIED,
};
const NOTICES = [unwrap(notices([])), unwrap(notices([notice]))];
const open: Registration = {
  state: "open",
  url: null,
  evidenceUrl: EVIDENCE,
  verifiedAt: stamp("2026-02-01T00:00:00.000Z"),
};
const unknown: Registration = {
  state: "unknown",
  url: null,
  evidenceUrl: EVIDENCE,
  verifiedAt: null,
};

function event(rng: Random): CanonicalEvent {
  return {
    title: field(rng, TEXTS),
    description: field(rng, [...TEXTS, null]),
    dates: field(rng, ranges(rng).built),
    lifecycle: field(rng, LIFECYCLES),
    location: field(rng, [...TEXTS, null]),
    attendance: field(rng, [null, { policy: "public", note: "Open." }]),
    registration: field(rng, [null, unknown, open]),
    notices: field(rng, NOTICES),
  };
}

const orderedField = ({ dates: value }: CanonicalEvent) =>
  value.value.kind === "approximate" ||
  (value.value.start <= value.value.end && value.value.previous !== value.value.start);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe("parsers", () => {
  it.each([
    [isoDay, "2026-02-28", true],
    [isoDay, "2026-02-30", false],
    [isoDay, "2026-3-1", false],
    [isoInstant, "2026-01-01T00:00:00.000Z", true],
    [isoInstant, "2026-01-01T00:00:00Z", false],
    [isoInstant, "2026-13-01T00:00:00.000Z", false],
    [timestamp, "2026-01-01T00:00:00Z", true],
    [timestamp, "2026-01-01T00:00:00.5Z", true],
    [timestamp, "2026-03-01", true],
    [timestamp, "2026-02-30", false],
    [timestamp, "2026-01-01T25:00:00Z", false],
    [timestamp, "2026-01-01 00:00:00Z", false],
    [timestamp, "2026-01-01T00:00:00+05:30", false],
    [httpsUrl, "https://x.org/e", true],
    [httpsUrl, "http://x.org/e", false],
    [httpsUrl, "https://user:pw@x.org/e", false],
    [httpsUrl, "https://:pw@x.org/e", false],
    [httpsUrl, "https://user@x.org/e", false],
    [httpsUrl, "not a url", false],
    [text, "Odia meetup", true],
    [text, "  ", false],
    [noticeText, "x".repeat(1000), true],
    [noticeText, "x".repeat(1001), false],
    [noticeText, " ", false],
  ])("%o accepts %s: %s", (parse, input, ok) => {
    expect(parse(input).ok).toBe(ok);
  });
});

describe("dates", () => {
  it("rejects exactly the ranges that end before they start or move to their own day, over 20,000 random draws", () => {
    const rng = random(12345);
    const wrong: string[] = [];
    let rejected = 0;
    for (let i = 0; i < 20_000; i += 1)
      for (const { start, end, previous, result } of ranges(rng).attempts) {
        if (result.ok !== (end >= start && previous !== start)) wrong.push(`${start}..${end}`);
        if (!result.ok) rejected += 1;
      }
    expect(wrong).toEqual([]);
    expect(rejected).toBeGreaterThan(10_000);
    expect(dates({ start: MARCH_5, end: MARCH_1, previous: null })).toEqual({
      ok: false,
      error: "end-before-start",
    });
    expect(dates({ start: MARCH_1, end: MARCH_5, previous: MARCH_1 })).toEqual({
      ok: false,
      error: "moved-to-same-day",
    });
  });

  it("keeps branded dates independent of the object they were built from", () => {
    const source = { start: MARCH_1, end: MARCH_5, previous: null };
    const branded = unwrap(dates(source));
    source.end = MARCH_1;
    expect(branded.end).toBe(MARCH_5);
  });

  it("freezes a branded notice list so a mutable alias cannot grow it past 20", () => {
    const alias: { [index: number]: Notice } = unwrap(
      notices(Array.from({ length: 20 }, () => notice)),
    );
    expect(() => (alias[20] = notice)).toThrow(TypeError);
  });

  it("copies and freezes each notice so neither its source nor a mutable alias can change it", () => {
    const source = { ...notice };
    const [entry] = unwrap(notices([source]));
    source.text = unwrap(noticeText("Changed."));
    const alias: { text: string } | undefined = entry;
    expect(entry?.text).toBe("Moved.");
    expect(() => alias && (alias.text = "")).toThrow(TypeError);
  });

  it("only lets nullable fields be cleared, and only by a reviewed null", () => {
    type Cleared = { kind: "reviewed"; value: null; at: typeof MAR; evidence: typeof EVIDENCE };
    type Tombstone = { kind: "cleared"; at: typeof MAR; evidence: typeof EVIDENCE };
    expectTypeOf<Cleared>().not.toExtend<CanonicalEvent["title"]>();
    expectTypeOf<Cleared>().not.toExtend<CanonicalEvent["dates"]>();
    expectTypeOf<Cleared>().not.toExtend<CanonicalEvent["notices"]>();
    expectTypeOf<Cleared>().toExtend<CanonicalEvent["location"]>();
    expectTypeOf<Tombstone>().not.toExtend<CanonicalEvent["location"]>();
  });

  it("freezes branded dates so a mutable alias cannot put the end before the start", () => {
    const alias: { kind: "exact"; start: typeof MARCH_1; end: typeof MARCH_1 } = range(
      MARCH_1,
      MARCH_5,
    );
    expect(() => (alias.end = MARCH_1)).toThrow(TypeError);
    expectTypeOf<{ kind: "exact"; start: string; end: string }>().not.toExtend<ExactDates>();
  });

  it("cannot be forged by spreading or merging a checked range", () => {
    const checkedRange = range(MARCH_1, MARCH_5);
    expectTypeOf({ ...checkedRange, start: APRIL_10 }).not.toExtend<ExactDates>();
    expectTypeOf({ ...checkedRange }).not.toExtend<Dates>();
    const merged: object = Object.assign({}, checkedRange, { start: APRIL_10 });
    expect(ExactDates.has(merged)).toBe(false);
    expect(ExactDates.has(checkedRange)).toBe(true);
    expect(ExactDates.has(LATE_2025)).toBe(false);
  });
});

describe("nested facts", () => {
  it("caps notices at 20", () => {
    expect(notices(Array.from({ length: 20 }, () => notice)).ok).toBe(true);
    expect(notices(Array.from({ length: 21 }, () => notice))).toEqual({
      ok: false,
      error: "too-many-notices",
    });
  });

  it("keeps a branded notice list independent of the array it was built from", () => {
    const source = Array.from({ length: 20 }, () => notice);
    const branded = unwrap(notices(source));
    source.push(notice);
    expect(branded).toHaveLength(20);
  });

  it("moves a rescheduled event's dates to its exact new range, keeping the original day", () => {
    const rescheduled: Lifecycle = { kind: "rescheduled", ...checked };
    const moved = range(APRIL_10, APRIL_10, MARCH_1);
    const curated: CanonicalEvent = {
      ...event(random(5)),
      dates: { kind: "upstream", value: LATE_2025, seen: JAN },
    };
    const corrected = applyCorrection(curated, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { lifecycle: rescheduled, dates: moved },
    });
    expect(corrected.lifecycle).toEqual({
      kind: "reviewed",
      value: rescheduled,
      at: MAR,
      evidence: EVIDENCE,
    });
    expect(corrected.dates).toEqual({
      kind: "reviewed",
      value: moved,
      at: MAR,
      evidence: EVIDENCE,
    });
    expectTypeOf<{ kind: "cancelled" }>().not.toExtend<Lifecycle>();
    expectTypeOf<{
      kind: "rescheduled";
      dates: typeof moved;
      evidenceUrl: typeof OFFICIAL;
      verifiedAt: typeof VERIFIED;
    }>().not.toEqualTypeOf<Lifecycle>();
    expectTypeOf<{
      at: typeof MAR;
      evidence: typeof EVIDENCE;
      patch: { lifecycle: typeof rescheduled & { kind: "rescheduled" } };
    }>().not.toExtend<Correction>();
    expectTypeOf<{
      at: typeof MAR;
      evidence: typeof EVIDENCE;
      patch: { lifecycle: typeof rescheduled & { kind: "rescheduled" }; dates: typeof LATE_2025 };
    }>().not.toExtend<Correction>();
    expectTypeOf<{
      at: typeof MAR;
      evidence: typeof EVIDENCE;
      patch: { lifecycle: typeof rescheduled & { kind: "rescheduled" }; dates: typeof moved };
    }>().toExtend<Correction>();
  });

  it("require evidence for a known registration state and https evidence on notices", () => {
    expectTypeOf<{ state: "open"; url: null }>().not.toExtend<Registration>();
    expectTypeOf(unknown).toExtend<Registration>();
    expectTypeOf<readonly Notice[]>().not.toExtend<CanonicalEvent["notices"]>();
    expectTypeOf<{
      kind: "venue";
      text: string;
      evidenceUrl: string;
      verifiedAt: string;
    }>().not.toExtend<Notice>();
    expectTypeOf(open).toExtend<Registration>();
    expectTypeOf({ ...open, verifiedAt: VERIFIED_DAY }).toExtend<Registration>();
    expectTypeOf({ ...notice, verifiedAt: VERIFIED_DAY }).toExtend<Notice>();
    expectTypeOf<{
      kind: "cancelled";
      evidenceUrl: typeof OFFICIAL;
      verifiedAt: typeof VERIFIED_DAY;
    }>().toExtend<Lifecycle>();
  });
});

describe("join", () => {
  it("is commutative, associative and idempotent and keeps end >= start on 20,000 triples", () => {
    const rng = random(12345);
    const broken: string[] = [];
    for (let i = 0; i < 20_000; i += 1) {
      const [a, b, c] = [event(rng), event(rng), event(rng)];
      const ab = join(a, b);
      if (!same(ab, join(b, a))) broken.push(`commutative ${String(i)}`);
      if (!same(join(ab, c), join(a, join(b, c)))) broken.push(`associative ${String(i)}`);
      if (!same(join(a, a), a)) broken.push(`idempotent ${String(i)}`);
      if (!orderedField(ab)) broken.push(`end before start ${String(i)}`);
    }
    expect(broken).toEqual([]);
  });

  it("keeps an older reviewed range over a newer upstream start day", () => {
    const base = event(random(1));
    const reviewed: CanonicalEvent = {
      ...base,
      dates: { kind: "reviewed", value: range(MARCH_1, MARCH_5), at: FEB, evidence: EVIDENCE },
    };
    const upstream: CanonicalEvent = {
      ...base,
      dates: { kind: "upstream", value: range(APRIL_10, APRIL_10), seen: MAR },
    };
    expect(join(reviewed, upstream).dates).toEqual(reviewed.dates);
    expect(join(upstream, reviewed).dates).toEqual(reviewed.dates);
  });

  it("lets newer upstream dates through after a lifecycle-only review", () => {
    const base = event(random(4));
    const cancelled: CanonicalEvent = {
      ...base,
      lifecycle: {
        kind: "reviewed",
        value: { kind: "cancelled", ...checked },
        at: FEB,
        evidence: EVIDENCE,
      },
      dates: { kind: "upstream", value: range(MARCH_1, MARCH_1), seen: JAN },
    };
    const moved: CanonicalEvent = {
      ...base,
      lifecycle: { kind: "upstream", value: { kind: "scheduled", ...checked }, seen: MAR },
      dates: { kind: "upstream", value: range(MARCH_1, MARCH_5), seen: MAR },
    };
    const joined = join(cancelled, moved);
    expect(joined.lifecycle).toEqual(cancelled.lifecycle);
    expect(joined.dates).toEqual(moved.dates);
  });

  it("keeps one current range when a rescheduled review meets older upstream dates", () => {
    const base: CanonicalEvent = {
      ...event(random(7)),
      lifecycle: { kind: "upstream", value: null, seen: JAN },
      dates: { kind: "upstream", value: range(MARCH_1, MARCH_1), seen: JAN },
    };
    const upstream: CanonicalEvent = {
      ...base,
      lifecycle: { kind: "upstream", value: { kind: "scheduled", ...checked }, seen: MAR },
      dates: { kind: "upstream", value: range(MARCH_5, MARCH_5), seen: MAR },
    };
    const rescheduled = applyCorrection(base, {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "rescheduled", ...checked }, dates: range(APRIL_10, APRIL_10) },
    });
    for (const joined of [join(rescheduled, upstream), join(upstream, rescheduled)]) {
      expect(joined.lifecycle.value?.kind).toBe("rescheduled");
      expect(joined.dates.value).toEqual(range(APRIL_10, APRIL_10));
    }
  });

  it("keeps an imprecisely dated event until a review gives it exact days", () => {
    const base = event(random(6));
    const curated: CanonicalEvent = {
      ...base,
      dates: { kind: "upstream", value: LATE_2025, seen: MAR },
    };
    const reviewed: CanonicalEvent = {
      ...base,
      dates: { kind: "reviewed", value: range(MARCH_1, MARCH_5), at: JAN, evidence: EVIDENCE },
    };
    expect(join(curated, curated).dates).toEqual(curated.dates);
    expect(join(curated, reviewed).dates).toEqual(reviewed.dates);
  });

  it("lets a newer clear beat an older review and a newer review beat an older clear", () => {
    const base = event(random(3));
    const at = (location: CanonicalEvent["location"]) => ({ ...base, location });
    const reviewed = at({ kind: "reviewed", value: A, at: FEB, evidence: EVIDENCE });
    const cleared = at({ kind: "reviewed", value: null, at: MAR, evidence: EVIDENCE });
    const older = at({ kind: "reviewed", value: null, at: JAN, evidence: EVIDENCE });
    expect(join(reviewed, cleared).location).toEqual(cleared.location);
    expect(join(cleared, reviewed).location).toEqual(cleared.location);
    expect(join(older, reviewed).location).toEqual(reviewed.location);
    expect(join(reviewed, older).location).toEqual(reviewed.location);
  });

  it("lets a newer upstream value replace an older one but never fill it with null", () => {
    const base = event(random(2));
    const at = (location: CanonicalEvent["location"]) => ({ ...base, location });
    const old = at({ kind: "upstream", value: A, seen: JAN });
    const newer = at({ kind: "upstream", value: B, seen: FEB });
    const empty = at({ kind: "upstream", value: null, seen: MAR });
    expect(join(old, newer).location).toEqual(newer.location);
    expect(join(newer, empty).location).toEqual(newer.location);
  });
});

describe("applyCorrection", () => {
  const seen = <T>(value: T): Field<T> => ({
    kind: "upstream",
    value,
    seen: JAN,
  });
  const base: CanonicalEvent = {
    title: { kind: "reviewed", value: A, at: FEB, evidence: EVIDENCE },
    description: seen(null),
    dates: seen(range(MARCH_1, MARCH_1)),
    lifecycle: seen<Lifecycle | null>(null),
    location: seen(C),
    attendance: seen(null),
    registration: seen(null),
    notices: seen(unwrap(notices([]))),
  };

  it("stamps each patched field with the correction's time and evidence", () => {
    const corrected = applyCorrection(base, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { title: B, location: null },
    });
    expect(corrected.title).toEqual({ kind: "reviewed", value: B, at: MAR, evidence: EVIDENCE });
    expect(corrected.location).toEqual({
      kind: "reviewed",
      value: null,
      at: MAR,
      evidence: EVIDENCE,
    });
    expect({ ...corrected, title: base.title, location: base.location }).toEqual(base);
  });

  it("keeps a rescheduled range when a later correction cancels the event", () => {
    const moved = range(APRIL_10, APRIL_10, MARCH_1);
    const rescheduled = applyCorrection(base, {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "rescheduled", ...checked }, dates: moved },
    });
    const cancelled = applyCorrection(rescheduled, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "cancelled", ...checked } },
    });
    expect(cancelled.dates.value).toEqual(moved);
  });

  it("declines a reschedule whose exact range is outranked by newer reviewed dates", () => {
    const curated: CanonicalEvent = {
      ...base,
      lifecycle: { kind: "upstream", value: { kind: "scheduled", ...checked }, seen: JAN },
      dates: { kind: "reviewed", value: LATE_2025, at: MAR, evidence: EVIDENCE },
    };
    const stale = applyCorrection(curated, {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "rescheduled", ...checked }, dates: range(APRIL_10, APRIL_10) },
    });
    expect(stale.dates).toEqual(curated.dates);
    expect(stale.lifecycle).toEqual(curated.lifecycle);
  });

  it("pins the current dates when a correction postpones the event", () => {
    const postponed = applyCorrection(base, {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "postponed", ...checked } },
    });
    expect(postponed.dates).toEqual({
      kind: "reviewed",
      value: base.dates.value,
      at: FEB,
      evidence: EVIDENCE,
    });
    const newer: CanonicalEvent = {
      ...base,
      dates: { kind: "upstream", value: range(MARCH_5, APRIL_10), seen: MAR },
    };
    expect(join(postponed, newer).dates).toEqual(postponed.dates);
    expect(join(newer, postponed).dates.value).toEqual(range(MARCH_1, MARCH_1));
  });

  it("takes a postponement's own dates when it gives them", () => {
    const corrected = applyCorrection(base, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "postponed", ...checked }, dates: LATE_2025 },
    });
    expect(corrected.dates.value).toEqual(LATE_2025);
  });

  it("does not let an older correction overwrite a newer review", () => {
    const corrected = applyCorrection(base, { at: JAN, evidence: EVIDENCE, patch: { title: C } });
    expect(corrected.title).toEqual(base.title);
  });
});
