import type { Event, EventNotice, EventRegistration } from "@/data/events/types";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoDay = Brand<string, "IsoDay">;
export type IsoInstant = Brand<string, "IsoInstant">;
export type HttpsUrl = Brand<string, "HttpsUrl">;
export type Text = Brand<string, "Text">;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function parser<T extends string, E extends string>(
  valid: (value: string) => value is T,
  error: E,
) {
  return (value: string): Result<T, E> =>
    valid(value) ? { ok: true, value } : { ok: false, error };
}

const roundTrips = (value: string, length: number) =>
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, length) === value;

export const isoDay = parser(
  (value): value is IsoDay => /^\d{4}-\d{2}-\d{2}$/.test(value) && roundTrips(value, 10),
  "invalid-day",
);

export const isoInstant = parser(
  (value): value is IsoInstant =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && roundTrips(value, 24),
  "invalid-instant",
);

export const httpsUrl = parser((value): value is HttpsUrl => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "invalid-url");

export const text = parser((value): value is Text => value.trim() !== "", "blank-text");

type ScheduleShape =
  | { readonly kind: "day"; readonly day: IsoDay }
  | { readonly kind: "range"; readonly start: IsoDay; readonly end: IsoDay }
  | {
      readonly kind: "postponed";
      readonly previous: IsoDay | null;
      readonly replacement: IsoDay | null;
    }
  | { readonly kind: "cancelled"; readonly day: IsoDay | null };

export type Schedule = Brand<ScheduleShape, "Schedule">;

const ordered = (shape: ScheduleShape): shape is Schedule =>
  shape.kind !== "range" || shape.start <= shape.end;

export function schedule(shape: ScheduleShape): Result<Schedule, "end-before-start"> {
  return ordered(shape) ? { ok: true, value: shape } : { ok: false, error: "end-before-start" };
}

export type Field<T> =
  | { readonly kind: "upstream"; readonly value: T; readonly seen: IsoInstant }
  | {
      readonly kind: "reviewed";
      readonly value: T;
      readonly at: IsoInstant;
      readonly evidence: HttpsUrl;
    }
  | { readonly kind: "cleared"; readonly at: IsoInstant; readonly evidence: HttpsUrl };

export type Attendance = Readonly<NonNullable<Event["attendance"]>>;
export type Registration = Readonly<EventRegistration>;
export type Notice = Readonly<EventNotice>;

type Values = {
  title: Text;
  description: Text;
  schedule: Schedule;
  location: Text | null;
  attendance: Attendance | null;
  registration: Registration | null;
  notices: readonly Notice[];
};

export type CanonicalEvent = { readonly [K in keyof Values]: Field<Values[K]> };

export type Correction = {
  readonly at: IsoInstant;
  readonly evidence: HttpsUrl;
  readonly patch: { readonly [K in keyof Values]?: Values[K] };
};

function rank<T>(field: Field<T>) {
  if (field.kind !== "upstream") return `2${field.at}${JSON.stringify(field)}`;
  return `${field.value === null ? "0" : "1"}${field.seen}${JSON.stringify(field)}`;
}

function later<T>(a: Field<T>, b: Field<T>): Field<T> {
  return rank(b) > rank(a) ? b : a;
}

export function join(a: CanonicalEvent, b: CanonicalEvent): CanonicalEvent {
  return {
    title: later(a.title, b.title),
    description: later(a.description, b.description),
    schedule: later(a.schedule, b.schedule),
    location: later(a.location, b.location),
    attendance: later(a.attendance, b.attendance),
    registration: later(a.registration, b.registration),
    notices: later(a.notices, b.notices),
  };
}

export function applyCorrection(event: CanonicalEvent, correction: Correction): CanonicalEvent {
  const { at, evidence, patch } = correction;
  const review = <T>(field: Field<T>, value: T | undefined): Field<T> =>
    value === undefined ? field : later(field, { kind: "reviewed", value, at, evidence });
  return {
    title: review(event.title, patch.title),
    description: review(event.description, patch.description),
    schedule: review(event.schedule, patch.schedule),
    location: review(event.location, patch.location),
    attendance: review(event.attendance, patch.attendance),
    registration: review(event.registration, patch.registration),
    notices: review(event.notices, patch.notices),
  };
}
