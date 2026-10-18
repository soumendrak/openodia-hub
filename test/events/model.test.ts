import { describe, expect, expectTypeOf, it } from "vitest";
import {
  applyCorrection,
  attendance,
  ExactDates,
  httpsUrl,
  isoDay,
  isoInstant,
  join,
  notice,
  notices,
  noticeText,
  reviewed,
  text,
  timestamp,
  upstream,
  type CanonicalEvent,
  type Attendance,
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
  if (rng.next() < 0.45) return upstream(rng.pick(values), rng.pick(TIMES));
  return reviewed(rng.pick(values), rng.pick(TIMES), EVIDENCE);
}

function ranges(rng: Random) {
  const attempts = DAYS.map(() => {
    const start = rng.pick(DAYS);
    const end = rng.pick(DAYS);
    const previous = rng.next() < 0.5 ? null : rng.pick(DAYS);
    return { start, end, previous, result: ExactDates.of({ start, end, previous }) };
  });
  const day = rng.pick(DAYS);
  const built: Dates[] = [
    unwrap(ExactDates.of({ start: day, end: day, previous: null })),
    LATE_2025,
  ];
  for (const { result } of attempts) if (result.ok) built.push(result.value);
  return { attempts, built };
}

const OFFICIAL = unwrap(httpsUrl("https://x.org/official"));
const checked = { evidenceUrl: OFFICIAL, verifiedAt: VERIFIED };
const range = (
  start: typeof MARCH_1,
  end: typeof MARCH_1,
  previous: typeof MARCH_1 | null = null,
) => unwrap(ExactDates.of({ start, end, previous }));
const LIFECYCLES: (Lifecycle | null)[] = [
  null,
  { kind: "scheduled", ...checked },
  { kind: "postponed", ...checked },
  { kind: "rescheduled", ...checked },
  { kind: "cancelled", ...checked },
];
const MOVED = {
  kind: "venue",
  text: unwrap(noticeText("Moved.")),
  evidenceUrl: EVIDENCE,
  verifiedAt: VERIFIED,
} as const;
const venue = notice(MOVED);
const NOTICES = [unwrap(notices([])), unwrap(notices([venue]))];
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
    attendance: field(rng, [null, attendance("public", "Open.")]),
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
    expect(ExactDates.of({ start: MARCH_5, end: MARCH_1, previous: null })).toEqual({
      ok: false,
      error: "end-before-start",
    });
    expect(ExactDates.of({ start: MARCH_1, end: MARCH_5, previous: MARCH_1 })).toEqual({
      ok: false,
      error: "moved-to-same-day",
    });
  });

  it("keeps branded dates independent of the object they were built from", () => {
    const source = { start: MARCH_1, end: MARCH_5, previous: null };
    const branded = unwrap(ExactDates.of(source));
    source.end = MARCH_1;
    expect(branded.end).toBe(MARCH_5);
  });

  it("freezes a branded notice list so a mutable alias cannot grow it past 20", () => {
    const alias: { [index: number]: Notice } = unwrap(
      notices(Array.from({ length: 20 }, () => venue)),
    );
    expect(() => (alias[20] = venue)).toThrow(TypeError);
  });

  it("builds each notice as a frozen copy that neither its source nor a mutable alias can change", () => {
    const source = { ...MOVED };
    const built = notice(source);
    source.text = unwrap(noticeText("Changed."));
    const alias: { text: string } = built;
    expect(built.text).toBe("Moved.");
    expect(() => (alias.text = "")).toThrow(TypeError);
  });

  it("only lets nullable fields be cleared, and only by a reviewed null", () => {
    const cleared = reviewed(null, MAR, EVIDENCE);
    expectTypeOf(cleared).not.toExtend<CanonicalEvent["title"]>();
    expectTypeOf(cleared).not.toExtend<CanonicalEvent["dates"]>();
    expectTypeOf(cleared).not.toExtend<CanonicalEvent["notices"]>();
    expectTypeOf(cleared).toExtend<CanonicalEvent["location"]>();
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
  });
});

describe("nested facts", () => {
  it("caps notices at 20", () => {
    expect(notices(Array.from({ length: 20 }, () => venue)).ok).toBe(true);
    expect(notices(Array.from({ length: 21 }, () => venue))).toEqual({
      ok: false,
      error: "too-many-notices",
    });
  });

  it("builds fields, attendance and notices only through their constructors, frozen", () => {
    expectTypeOf<{ kind: "upstream"; value: typeof A; seen: typeof JAN }>().not.toExtend<
      Field<typeof A>
    >();
    expectTypeOf<{
      kind: "reviewed";
      value: typeof A;
      at: typeof JAN;
      evidence: typeof EVIDENCE;
    }>().not.toExtend<Field<typeof A>>();
    expectTypeOf({ ...upstream(A, JAN) }).not.toExtend<Field<typeof A>>();
    expectTypeOf<{ policy: "public"; note: string }>().not.toExtend<Attendance>();
    expectTypeOf([{ ...MOVED }]).not.toExtend<Parameters<typeof notices>[0]>();
    const field: { value: unknown } = upstream(A, JAN);
    const review: { value: unknown } = reviewed(A, JAN, EVIDENCE);
    const policy: { note: string } = attendance("public", "Open.");
    expect(() => (field.value = B)).toThrow(TypeError);
    expect(() => (review.value = B)).toThrow(TypeError);
    expect(() => (policy.note = "")).toThrow(TypeError);
  });

  it("freezes the value a field admits, so a mutable alias cannot change the fact afterwards", () => {
    const late = { kind: "approximate" as const, label: A };
    const cancelled = { kind: "cancelled" as const, ...checked };
    const fields = [reviewed<Dates>(late, MAR, EVIDENCE), upstream<Lifecycle>(cancelled, MAR)];
    const aliases: [{ label: string }, { kind: string }] = [late, cancelled];
    expect(() => (aliases[0].label = "B")).toThrow(TypeError);
    expect(() => (aliases[1].kind = "scheduled")).toThrow(TypeError);
    expect(fields.map((field) => field.value)).toEqual([late, cancelled]);
  });

  it("takes review and correction times only as canonical instants", () => {
    expectTypeOf<typeof VERIFIED>().not.toExtend<Parameters<typeof reviewed>[1]>();
    expectTypeOf<typeof VERIFIED>().not.toExtend<Correction["at"]>();
    expectTypeOf<typeof JAN>().toExtend<Correction["at"]>();
  });

  it("builds exact dates only through ExactDates.of, even reflectively", () => {
    expect(() => Reflect.construct(ExactDates, [MARCH_5, MARCH_1, null])).toThrow(TypeError);
  });

  it("freezes the events join and applyCorrection return, so a widened alias cannot clear a title", () => {
    const shared = event(random(9));
    const correction: Correction = { at: JAN, evidence: EVIDENCE, patch: {} };
    const widened: { title: unknown }[] = [
      join(shared, shared),
      applyCorrection(shared, correction),
    ];
    for (const alias of widened) expect(() => (alias.title = null)).toThrow(TypeError);
  });

  it("copies notices by index, rejecting empty slots and ignoring a list's own iterator", () => {
    const skipping = Object.assign([venue], { *[Symbol.iterator]() {} });
    expect(notices(new Array<Notice>(1))).toEqual({ ok: false, error: "missing-notice" });
    expect(unwrap(notices(skipping))).toEqual([venue]);
  });

  it("keeps a branded notice list independent of the array it was built from", () => {
    const source = Array.from({ length: 20 }, () => venue);
    const branded = unwrap(notices(source));
    source.push(venue);
    expect(branded).toHaveLength(20);
  });

  it("moves a rescheduled event's dates to its exact new range, keeping the original day", () => {
    const rescheduled: Lifecycle = { kind: "rescheduled", ...checked };
    const moved = range(APRIL_10, APRIL_10, MARCH_1);
    const curated: CanonicalEvent = {
      ...event(random(5)),
      dates: upstream(LATE_2025, JAN),
    };
    const corrected = applyCorrection(curated, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { lifecycle: rescheduled, dates: moved },
    });
    expect(corrected.lifecycle).toEqual(reviewed(rescheduled, MAR, EVIDENCE));
    expect(corrected.dates).toEqual(reviewed(moved, MAR, EVIDENCE));
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
    expectTypeOf({ ...MOVED, verifiedAt: VERIFIED_DAY }).toExtend<Parameters<typeof notice>[0]>();
    expectTypeOf({ ...venue }).not.toExtend<Notice>();
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

  it("keeps parsed values from changing through a widened mutable alias", () => {
    const widened: { ok: boolean; value?: unknown }[] = [
      text("Valid"),
      ExactDates.of({ start: MARCH_1, end: MARCH_5, previous: null }),
    ];
    for (const alias of widened)
      expect(() => {
        alias.value = "";
      }).toThrow(TypeError);
  });

  it("keeps rejected parses from turning into successes through a widened mutable alias", () => {
    const widened: { ok: boolean }[] = [
      text(""),
      ExactDates.of({ start: MARCH_5, end: MARCH_1, previous: null }),
      ExactDates.of({ start: MARCH_1, end: MARCH_5, previous: MARCH_1 }),
      notices(Array.from({ length: 21 }, () => venue)),
    ];
    for (const alias of widened)
      expect(() => {
        alias.ok = true;
      }).toThrow(TypeError);
  });

  it("orders notice lists by an encoding that no notice text can imitate", () => {
    const second = notice({ ...MOVED, text: unwrap(noticeText("Second.")) });
    const spelled = `${venue.text}","evidenceUrl":"${venue.evidenceUrl}","verifiedAt":"${venue.verifiedAt}"},{"kind":"${venue.kind}","text":"${second.text}`;
    const single = notice({ ...MOVED, text: unwrap(noticeText(spelled)) });
    const shared = event(random(9));
    const listing = (list: readonly Notice[]): CanonicalEvent => ({
      ...shared,
      notices: upstream(unwrap(notices(list)), MAR),
    });
    const [a, b] = [listing([single]), listing([venue, second])];
    expect(join(a, b)).toEqual(join(b, a));
  });

  it("orders review times by instant, before 1970 and within a second", () => {
    const review = (at: typeof JAN, title: typeof A): Correction => ({
      at,
      evidence: EVIDENCE,
      patch: { title },
    });
    const shared = event(random(14));
    for (const [older, newer] of [
      [instant("1800-01-01T00:00:00.000Z"), instant("1900-01-01T00:00:00.000Z")],
      [instant("2026-03-01T00:00:00.100Z"), instant("2026-03-01T00:00:00.101Z")],
    ] as const)
      for (const order of [
        [review(older, A), review(newer, B)],
        [review(newer, B), review(older, A)],
      ])
        expect(order.reduce(applyCorrection, shared).title.value).toBe(B);
  });

  it("keeps an older reviewed range over a newer upstream start day", () => {
    const base = event(random(1));
    const vetted: CanonicalEvent = {
      ...base,
      dates: reviewed(range(MARCH_1, MARCH_5), FEB, EVIDENCE),
    };
    const listedUpstream: CanonicalEvent = {
      ...base,
      dates: upstream(range(APRIL_10, APRIL_10), MAR),
    };
    expect(join(vetted, listedUpstream).dates).toEqual(vetted.dates);
    expect(join(listedUpstream, vetted).dates).toEqual(vetted.dates);
  });

  it("lets newer upstream dates through after a lifecycle-only review", () => {
    const base = event(random(4));
    const cancelled: CanonicalEvent = {
      ...base,
      lifecycle: reviewed({ kind: "cancelled", ...checked }, FEB, EVIDENCE),
      dates: upstream(range(MARCH_1, MARCH_1), JAN),
    };
    const moved: CanonicalEvent = {
      ...base,
      lifecycle: upstream({ kind: "scheduled", ...checked }, MAR),
      dates: upstream(range(MARCH_1, MARCH_5), MAR),
    };
    const joined = join(cancelled, moved);
    expect(joined.lifecycle).toEqual(cancelled.lifecycle);
    expect(joined.dates).toEqual(moved.dates);
  });

  it("keeps one current range when a rescheduled review meets older upstream dates", () => {
    const base: CanonicalEvent = {
      ...event(random(7)),
      lifecycle: upstream(null, JAN),
      dates: upstream(range(MARCH_1, MARCH_1), JAN),
    };
    const listedUpstream: CanonicalEvent = {
      ...base,
      lifecycle: upstream({ kind: "scheduled", ...checked }, MAR),
      dates: upstream(range(MARCH_5, MARCH_5), MAR),
    };
    const rescheduled = applyCorrection(base, {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "rescheduled", ...checked }, dates: range(APRIL_10, APRIL_10) },
    });
    for (const joined of [join(rescheduled, listedUpstream), join(listedUpstream, rescheduled)]) {
      expect(joined.lifecycle.value?.kind).toBe("rescheduled");
      expect(joined.dates.value).toEqual(range(APRIL_10, APRIL_10));
    }
  });

  it("keeps an imprecisely dated event until a review gives it exact days", () => {
    const base = event(random(6));
    const curated: CanonicalEvent = {
      ...base,
      dates: upstream(LATE_2025, MAR),
    };
    const vetted: CanonicalEvent = {
      ...base,
      dates: reviewed(range(MARCH_1, MARCH_5), JAN, EVIDENCE),
    };
    expect(join(curated, curated).dates).toEqual(curated.dates);
    expect(join(curated, vetted).dates).toEqual(vetted.dates);
  });

  it("lets a newer clear beat an older review and a newer review beat an older clear", () => {
    const base = event(random(3));
    const at = (location: CanonicalEvent["location"]) => ({ ...base, location });
    const vetted = at(reviewed(A, FEB, EVIDENCE));
    const cleared = at(reviewed(null, MAR, EVIDENCE));
    const older = at(reviewed(null, JAN, EVIDENCE));
    expect(join(vetted, cleared).location).toEqual(cleared.location);
    expect(join(cleared, vetted).location).toEqual(cleared.location);
    expect(join(older, vetted).location).toEqual(vetted.location);
    expect(join(vetted, older).location).toEqual(vetted.location);
  });

  it("lets a newer upstream value replace an older one but never fill it with null", () => {
    const base = event(random(2));
    const at = (location: CanonicalEvent["location"]) => ({ ...base, location });
    const old = at(upstream(A, JAN));
    const newer = at(upstream(B, FEB));
    const empty = at(upstream(null, MAR));
    expect(join(old, newer).location).toEqual(newer.location);
    expect(join(newer, empty).location).toEqual(newer.location);
  });
});

describe("applyCorrection", () => {
  const seen = <T>(value: T): Field<T> => upstream(value, JAN);
  const base: CanonicalEvent = {
    title: reviewed(A, FEB, EVIDENCE),
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
    expect(corrected.title).toEqual(reviewed(B, MAR, EVIDENCE));
    expect(corrected.location).toEqual(reviewed(null, MAR, EVIDENCE));
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

  it("lets newer reviewed dates outrank a stale reschedule's range, whether applied or joined", () => {
    const listed: CanonicalEvent = {
      ...base,
      lifecycle: upstream({ kind: "scheduled", ...checked }, JAN),
      dates: upstream(range(MARCH_1, MARCH_1), JAN),
    };
    const curated = applyCorrection(listed, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { dates: LATE_2025 },
    });
    const stale: Correction = {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "rescheduled", ...checked }, dates: range(APRIL_10, APRIL_10) },
    };
    const moved = applyCorrection(listed, stale);
    const applied = applyCorrection(curated, stale);
    expect(applied.lifecycle.value?.kind).toBe("rescheduled");
    expect(applied.dates.value).toEqual(LATE_2025);
    expect(join(curated, moved)).toEqual(applied);
    expect(join(moved, curated)).toEqual(applied);
  });

  it("keeps the dates a postponement reviewed, whether it lands before or after newer upstream dates", () => {
    const postpone: Correction = {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "postponed", ...checked }, dates: range(MARCH_1, MARCH_1) },
    };
    const newer: CanonicalEvent = {
      ...base,
      dates: upstream(range(MARCH_5, APRIL_10), MAR),
    };
    const after = applyCorrection(join(base, newer), postpone);
    expect(after).toEqual(join(applyCorrection(base, postpone), newer));
    expect(after.dates).toEqual(reviewed(range(MARCH_1, MARCH_1), FEB, EVIDENCE));
    expectTypeOf<{
      at: typeof FEB;
      evidence: typeof EVIDENCE;
      patch: { lifecycle: { kind: "postponed" } & typeof checked };
    }>().not.toExtend<Correction>();
    expectTypeOf<{
      at: typeof FEB;
      evidence: typeof EVIDENCE;
      patch: { lifecycle: { kind: "postponed" } & typeof checked; dates: typeof LATE_2025 };
    }>().toExtend<Correction>();
  });

  it("keeps the dates a stale postponement reviewed, whether applied or joined, under a newer cancellation", () => {
    const listed: CanonicalEvent = {
      ...base,
      dates: upstream(range(MARCH_1, MARCH_1), JAN),
    };
    const cancelled = applyCorrection(listed, {
      at: MAR,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "cancelled", ...checked } },
    });
    const stale: Correction = {
      at: FEB,
      evidence: EVIDENCE,
      patch: { lifecycle: { kind: "postponed", ...checked }, dates: range(MARCH_1, MARCH_1) },
    };
    const applied = applyCorrection(cancelled, stale);
    expect(applied.lifecycle).toEqual(cancelled.lifecycle);
    expect(applied.dates).toEqual(reviewed(range(MARCH_1, MARCH_1), FEB, EVIDENCE));
    expect(join(cancelled, applyCorrection(listed, stale))).toEqual(applied);
  });

  it("does not let an older correction overwrite a newer review", () => {
    const corrected = applyCorrection(base, { at: JAN, evidence: EVIDENCE, patch: { title: C } });
    expect(corrected.title).toEqual(base.title);
  });
});
