import { describe, expect, expectTypeOf, it } from "vitest";
import {
  applyCorrection,
  dates,
  httpsUrl,
  isoDay,
  isoInstant,
  join,
  schedule,
  text,
  type CanonicalEvent,
  type Dates,
  type Field,
  type Notice,
  type Registration,
  type Result,
  type Schedule,
} from "../../src/events/model";

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`unexpected ${String(result.error)}`);
  return result.value;
}

const day = (value: string) => unwrap(isoDay(value));
const instant = (value: string) => unwrap(isoInstant(value));
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
  const roll = rng.next();
  if (roll < 0.4) return { kind: "upstream", value: rng.pick(values), seen: rng.pick(TIMES) };
  if (roll < 0.9)
    return { kind: "reviewed", value: rng.pick(values), at: rng.pick(TIMES), evidence: EVIDENCE };
  return { kind: "cleared", at: rng.pick(TIMES), evidence: EVIDENCE };
}

function schedules(rng: Random) {
  const attempts = DAYS.map(() => {
    const start = rng.pick(DAYS);
    const end = rng.pick(DAYS);
    return { start, end, result: dates({ start, end }) };
  });
  const day = rng.pick(DAYS);
  const ranges = [unwrap(dates({ start: day, end: day }))];
  for (const { result } of attempts) if (result.ok) ranges.push(result.value);
  const built = ranges.flatMap((range) => [
    unwrap(schedule({ kind: "scheduled", dates: range })),
    unwrap(schedule({ kind: "cancelled", dates: rng.pick([range, null]) })),
    unwrap(schedule({ kind: "postponed", previous: null, dates: rng.pick([range, null]) })),
  ]);
  return { attempts, built };
}

const notice: Notice = { kind: "venue", text: A, evidenceUrl: EVIDENCE, verifiedAt: JAN };
const open: Registration = { state: "open", url: null, evidenceUrl: EVIDENCE, verifiedAt: FEB };

function event(rng: Random): CanonicalEvent {
  return {
    title: field(rng, TEXTS),
    description: field(rng, TEXTS),
    schedule: field(rng, schedules(rng).built),
    location: field(rng, [...TEXTS, null]),
    attendance: field(rng, [null, { policy: "public", note: "Open." }]),
    registration: field(rng, [null, { state: "unknown", url: EVIDENCE }, open]),
    notices: field(rng, [[], [notice]]),
  };
}

const ordered = (value: Dates | null) => value === null || value.start <= value.end;
const orderedField = (value: Field<Schedule>) =>
  value.kind === "cleared" || ordered(value.value.dates);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe("parsers", () => {
  it.each([
    [isoDay, "2026-02-28", true],
    [isoDay, "2026-02-30", false],
    [isoDay, "2026-3-1", false],
    [isoInstant, "2026-01-01T00:00:00.000Z", true],
    [isoInstant, "2026-01-01T00:00:00Z", false],
    [isoInstant, "2026-13-01T00:00:00.000Z", false],
    [httpsUrl, "https://x.org/e", true],
    [httpsUrl, "http://x.org/e", false],
    [httpsUrl, "https://user:pw@x.org/e", false],
    [httpsUrl, "not a url", false],
    [text, "Odia meetup", true],
    [text, "  ", false],
  ])("%o accepts %s: %s", (parse, input, ok) => {
    expect(parse(input).ok).toBe(ok);
  });
});

describe("dates and schedule", () => {
  it("rejects exactly the ranges that end before they start, over 20,000 random draws", () => {
    const rng = random(12345);
    const wrong: string[] = [];
    let rejected = 0;
    for (let i = 0; i < 20_000; i += 1)
      for (const { start, end, result } of schedules(rng).attempts) {
        if (result.ok !== end >= start) wrong.push(`${start}..${end}`);
        if (!result.ok) rejected += 1;
      }
    expect(wrong).toEqual([]);
    expect(rejected).toBeGreaterThan(10_000);
    expect(dates({ start: MARCH_5, end: MARCH_1 })).toEqual({
      ok: false,
      error: "end-before-start",
    });
  });

  it("keeps a cancelled or postponed event's whole date range", () => {
    const range = unwrap(dates({ start: MARCH_1, end: MARCH_5 }));
    expect(unwrap(schedule({ kind: "cancelled", dates: range })).dates).toEqual(range);
    const later = unwrap(dates({ start: APRIL_10, end: APRIL_10 }));
    expect(unwrap(schedule({ kind: "postponed", previous: MARCH_1, dates: later }))).toEqual({
      kind: "postponed",
      previous: MARCH_1,
      dates: later,
    });
  });

  it("rejects a postponement to the day it already had", () => {
    const range = unwrap(dates({ start: MARCH_1, end: MARCH_5 }));
    expect(schedule({ kind: "postponed", previous: MARCH_1, dates: range })).toEqual({
      ok: false,
      error: "postponed-to-same-day",
    });
  });
});

describe("nested facts", () => {
  it("require evidence for a known registration state and https evidence on notices", () => {
    expectTypeOf<{ state: "open"; url: null }>().not.toExtend<Registration>();
    expectTypeOf<{ state: "unknown"; url: null }>().toExtend<Registration>();
    expectTypeOf<{
      kind: "venue";
      text: string;
      evidenceUrl: string;
      verifiedAt: string;
    }>().not.toExtend<Notice>();
    expectTypeOf(open).toExtend<Registration>();
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
      if (!orderedField(ab.schedule)) broken.push(`end before start ${String(i)}`);
    }
    expect(broken).toEqual([]);
  });

  it("keeps an older reviewed range over a newer upstream start day", () => {
    const base = event(random(1));
    const range = unwrap(
      schedule({ kind: "scheduled", dates: unwrap(dates({ start: MARCH_1, end: MARCH_5 })) }),
    );
    const reviewed: CanonicalEvent = {
      ...base,
      schedule: { kind: "reviewed", value: range, at: FEB, evidence: EVIDENCE },
    };
    const moved = unwrap(
      schedule({ kind: "scheduled", dates: unwrap(dates({ start: APRIL_10, end: APRIL_10 })) }),
    );
    const upstream: CanonicalEvent = {
      ...base,
      schedule: { kind: "upstream", value: moved, seen: MAR },
    };
    expect(join(reviewed, upstream).schedule).toEqual(reviewed.schedule);
    expect(join(upstream, reviewed).schedule).toEqual(reviewed.schedule);
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
  const seen = <T>(value: T): Field<T> => ({ kind: "upstream", value, seen: JAN });
  const base: CanonicalEvent = {
    title: { kind: "reviewed", value: A, at: FEB, evidence: EVIDENCE },
    description: seen(B),
    schedule: seen(
      unwrap(
        schedule({ kind: "scheduled", dates: unwrap(dates({ start: MARCH_1, end: MARCH_1 })) }),
      ),
    ),
    location: seen(C),
    attendance: seen(null),
    registration: seen(null),
    notices: seen([]),
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

  it("does not let an older correction overwrite a newer review", () => {
    const corrected = applyCorrection(base, { at: JAN, evidence: EVIDENCE, patch: { title: C } });
    expect(corrected.title).toEqual(base.title);
  });
});
