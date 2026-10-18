import { describe, expect, expectTypeOf, it } from "vitest";
import {
  applyCorrection,
  dates,
  httpsUrl,
  isoDay,
  isoInstant,
  join,
  notices,
  noticeText,
  text,
  type CanonicalEvent,
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

function ranges(rng: Random) {
  const attempts = DAYS.map(() => {
    const start = rng.pick(DAYS);
    const end = rng.pick(DAYS);
    const previous = rng.pick([null, ...DAYS]);
    return { start, end, previous, result: dates({ start, end, previous }) };
  });
  const day = rng.pick(DAYS);
  const built = [unwrap(dates({ start: day, end: day, previous: null }))];
  for (const { result } of attempts) if (result.ok) built.push(result.value);
  return { attempts, built };
}

const LIFECYCLES: Lifecycle[] = [
  { kind: "scheduled" },
  { kind: "postponed", rescheduled: false },
  { kind: "postponed", rescheduled: true },
  { kind: "cancelled" },
];
const notice: Notice = {
  kind: "venue",
  text: unwrap(noticeText("Moved.")),
  evidenceUrl: EVIDENCE,
  verifiedAt: JAN,
};
const NOTICES = [unwrap(notices([])), unwrap(notices([notice]))];
const open: Registration = { state: "open", url: null, evidenceUrl: EVIDENCE, verifiedAt: FEB };
const unknown: Registration = {
  state: "unknown",
  url: null,
  evidenceUrl: EVIDENCE,
  verifiedAt: null,
};
const range = (start: typeof MARCH_1, end: typeof MARCH_1) =>
  unwrap(dates({ start, end, previous: null }));

function event(rng: Random): CanonicalEvent {
  return {
    title: field(rng, TEXTS),
    description: field(rng, TEXTS),
    dates: field(rng, ranges(rng).built),
    lifecycle: field(rng, LIFECYCLES),
    location: field(rng, [...TEXTS, null]),
    attendance: field(rng, [null, { policy: "public", note: "Open." }]),
    registration: field(rng, [null, unknown, open]),
    notices: field(rng, NOTICES),
  };
}

const orderedField = ({ dates: value }: CanonicalEvent) =>
  value.kind === "cleared" ||
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
    [httpsUrl, "https://x.org/e", true],
    [httpsUrl, "http://x.org/e", false],
    [httpsUrl, "https://user:pw@x.org/e", false],
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
  it("rejects exactly the ranges that end before they start or move to the same day, over 20,000 random draws", () => {
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
});

describe("nested facts", () => {
  it("caps notices at 20", () => {
    expect(notices(Array.from({ length: 20 }, () => notice)).ok).toBe(true);
    expect(notices(Array.from({ length: 21 }, () => notice))).toEqual({
      ok: false,
      error: "too-many-notices",
    });
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
      lifecycle: { kind: "reviewed", value: { kind: "cancelled" }, at: FEB, evidence: EVIDENCE },
      dates: { kind: "upstream", value: range(MARCH_1, MARCH_1), seen: JAN },
    };
    const moved: CanonicalEvent = {
      ...base,
      lifecycle: { kind: "upstream", value: { kind: "scheduled" }, seen: MAR },
      dates: { kind: "upstream", value: range(MARCH_1, MARCH_5), seen: MAR },
    };
    const joined = join(cancelled, moved);
    expect(joined.lifecycle).toEqual(cancelled.lifecycle);
    expect(joined.dates).toEqual(moved.dates);
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
    dates: seen(range(MARCH_1, MARCH_1)),
    lifecycle: seen<Lifecycle>({ kind: "scheduled" }),
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

  it("does not let an older correction overwrite a newer review", () => {
    const corrected = applyCorrection(base, { at: JAN, evidence: EVIDENCE, patch: { title: C } });
    expect(corrected.title).toEqual(base.title);
  });
});
