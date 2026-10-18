import type {
  ATTENDANCE_POLICIES,
  EVENT_NOTICE_KINDS,
  REGISTRATION_STATES,
} from "@/data/events/types";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoDay = Brand<string, "IsoDay">;
export type IsoInstant = Brand<string, "IsoInstant">;
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

type ExactShape = { readonly kind: "exact" } & DateParts;

export type ExactDates = Brand<ExactShape, "ExactDates">;

export type Dates = ExactDates | { readonly kind: "approximate"; readonly label: Text };

const isExactDates = (shape: ExactShape): shape is ExactDates =>
  shape.start <= shape.end && shape.previous !== shape.start;

export function dates({
  start,
  end,
  previous,
}: DateParts): Result<ExactDates, "end-before-start" | "moved-to-same-day"> {
  const shape: ExactShape = Object.freeze({ kind: "exact", start, end, previous });
  if (isExactDates(shape)) return { ok: true, value: shape };
  return { ok: false, error: end < start ? "end-before-start" : "moved-to-same-day" };
}

export type Field<T> =
  | { readonly kind: "upstream"; readonly value: T; readonly seen: IsoInstant }
  | {
      readonly kind: "reviewed";
      readonly value: T;
      readonly at: IsoInstant;
      readonly evidence: HttpsUrl;
    };

type Verified = { readonly evidenceUrl: HttpsUrl; readonly verifiedAt: IsoDay | IsoInstant };

export type Lifecycle = (
  | { readonly kind: "scheduled" | "postponed" | "cancelled" }
  | { readonly kind: "rescheduled"; readonly dates: ExactDates }
) &
  Verified;

export type Attendance = {
  readonly policy: (typeof ATTENDANCE_POLICIES)[number];
  readonly note: string;
};

export type Registration =
  | {
      readonly state: "unknown";
      readonly url: HttpsUrl | null;
      readonly evidenceUrl: HttpsUrl | null;
      readonly verifiedAt: IsoDay | IsoInstant | null;
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

export const notices = (list: readonly Notice[]) => checkNotices(Object.freeze([...list]));

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

export type Correction = {
  readonly at: IsoInstant;
  readonly evidence: HttpsUrl;
  readonly patch: { readonly [K in keyof Values]?: Values[K] };
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
