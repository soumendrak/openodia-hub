import type {
  ATTENDANCE_POLICIES,
  EVENT_NOTICE_KINDS,
  REGISTRATION_STATES,
} from "@/data/events/types";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoDay = Brand<string, "IsoDay">;
export type IsoInstant = Brand<string, "IsoInstant">;
export type Timestamp = Brand<string, "Timestamp">;
export type HttpsUrl = Brand<string, "HttpsUrl">;
export type Text = Brand<string, "Text">;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function refine<S, T extends S, E extends string>(valid: (value: S) => value is T, error: E) {
  return (value: S): Result<T, E> => (valid(value) ? { ok: true, value } : { ok: false, error });
}

const roundTrips = (value: string, length: number) =>
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, length) === value;

export const isoDay = refine(
  (value: string): value is IsoDay => /^\d{4}-\d{2}-\d{2}$/.test(value) && roundTrips(value, 10),
  "invalid-day",
);

export const isoInstant = refine(
  (value: string): value is IsoInstant =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && roundTrips(value, 24),
  "invalid-instant",
);

export const timestamp = refine(
  (value: string): value is Timestamp =>
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/.test(value) &&
    isoDay(value.slice(0, 10)).ok &&
    !Number.isNaN(Date.parse(value)),
  "invalid-timestamp",
);

export const httpsUrl = refine((value: string): value is HttpsUrl => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "invalid-url");

export const text = refine((value: string): value is Text => value.trim() !== "", "blank-text");

type DateParts = {
  readonly start: IsoDay;
  readonly end: IsoDay;
  readonly previous: IsoDay | null;
};

export class ExactDates implements DateParts {
  readonly #checked = true;
  readonly kind = "exact";

  private constructor(
    readonly start: IsoDay,
    readonly end: IsoDay,
    readonly previous: IsoDay | null,
  ) {
    Object.freeze(this);
  }

  static has(value: object): value is ExactDates {
    return #checked in value;
  }

  static of({
    start,
    end,
    previous,
  }: DateParts): Result<ExactDates, "end-before-start" | "moved-to-same-day"> {
    if (end < start) return { ok: false, error: "end-before-start" };
    if (previous === start) return { ok: false, error: "moved-to-same-day" };
    return { ok: true, value: new ExactDates(start, end, previous) };
  }
}

export type Dates = ExactDates | { readonly kind: "approximate"; readonly label: Text };

export const dates = (parts: DateParts) => ExactDates.of(parts);

export type Field<T> =
  | { readonly kind: "upstream"; readonly value: T; readonly seen: IsoInstant }
  | {
      readonly kind: "reviewed";
      readonly value: T;
      readonly at: IsoInstant;
      readonly evidence: HttpsUrl;
    };

type Verified = { readonly evidenceUrl: HttpsUrl; readonly verifiedAt: Timestamp };

type Status = { readonly kind: "scheduled" | "cancelled" } & Verified;
type Paused = { readonly kind: "postponed" } & Verified;
type Moved = { readonly kind: "rescheduled" } & Verified;

export type Lifecycle = Status | Paused | Moved;

export type Attendance = {
  readonly policy: (typeof ATTENDANCE_POLICIES)[number];
  readonly note: string;
};

export type Registration =
  | {
      readonly state: "unknown";
      readonly url: HttpsUrl | null;
      readonly evidenceUrl: HttpsUrl | null;
      readonly verifiedAt: Timestamp | null;
    }
  | ({
      readonly state: Exclude<(typeof REGISTRATION_STATES)[number], "unknown">;
      readonly url: HttpsUrl | null;
    } & Verified);

export type NoticeText = Brand<string, "NoticeText">;

export const noticeText = refine(
  (value: string): value is NoticeText => value.trim() !== "" && value.length <= 1000,
  "invalid-notice-text",
);

export type Notice = {
  readonly kind: (typeof EVENT_NOTICE_KINDS)[number];
  readonly text: NoticeText;
} & Verified;

export type Notices = Brand<readonly Notice[], "Notices">;

const checkNotices = refine(
  (list: readonly Notice[]): list is Notices => list.length <= 20,
  "too-many-notices",
);

export const notices = (
  list: readonly Notice[],
): Result<Notices, "too-many-notices" | "sparse-notices"> =>
  list.reduce((count) => count + 1, 0) < list.length
    ? { ok: false, error: "sparse-notices" }
    : checkNotices(Object.freeze(list.map((entry) => Object.freeze({ ...entry }))));

type Values = {
  title: Text;
  description: Text | null;
  dates: Dates;
  lifecycle: Lifecycle | null;
  location: Text | null;
  attendance: Attendance | null;
  registration: Registration | null;
  notices: Notices;
};

export type CanonicalEvent = { readonly [K in keyof Values]: Field<Values[K]> };

type Patch = { readonly [K in keyof Values]?: Values[K] };

export type Correction = {
  readonly at: IsoInstant;
  readonly evidence: HttpsUrl;
  readonly patch:
    | (Patch & { readonly lifecycle?: Status | null })
    | (Patch & { readonly lifecycle: Paused; readonly dates: Dates })
    | (Patch & { readonly lifecycle: Moved; readonly dates: ExactDates });
};

function rank(field: Field<unknown>) {
  if (field.kind !== "upstream") return `2${field.at}${JSON.stringify(field)}`;
  return `${field.value === null ? "0" : "1"}${field.seen}${JSON.stringify(field)}`;
}

function later<F extends Field<unknown>>(a: F, b: F): F {
  return rank(b) > rank(a) ? b : a;
}

export function join(a: CanonicalEvent, b: CanonicalEvent): CanonicalEvent {
  return {
    title: later(a.title, b.title),
    description: later(a.description, b.description),
    dates: later(a.dates, b.dates),
    lifecycle: later(a.lifecycle, b.lifecycle),
    location: later(a.location, b.location),
    attendance: later(a.attendance, b.attendance),
    registration: later(a.registration, b.registration),
    notices: later(a.notices, b.notices),
  };
}

export function applyCorrection(event: CanonicalEvent, correction: Correction): CanonicalEvent {
  const { at, evidence, patch } = correction;
  const review = <T>(field: Field<T>, value: T | undefined) =>
    value === undefined ? field : later(field, { kind: "reviewed", value, at, evidence });
  return {
    title: review(event.title, patch.title),
    description: review(event.description, patch.description),
    dates: review(event.dates, patch.dates),
    lifecycle: review(event.lifecycle, patch.lifecycle),
    location: review(event.location, patch.location),
    attendance: review(event.attendance, patch.attendance),
    registration: review(event.registration, patch.registration),
    notices: review(event.notices, patch.notices),
  };
}
