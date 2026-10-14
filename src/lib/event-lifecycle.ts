import type { Event } from "../data/events/types";
import {
  ATTENDANCE_POLICIES,
  EVENT_LIFECYCLES,
  EVENT_NOTICE_KINDS,
  REGISTRATION_STATES,
} from "../data/events/types";
import { eventUrlKey, mergeEventCollectionsByUrl } from "./event-url";
import { mergeNonEmpty } from "./utils";

export const REVIEW_FIELDS = [
  "title",
  "description",
  "startDate",
  "endDate",
  "location",
  "attendance",
  "lifecycle",
  "registration",
  "notices",
] as const;
export type EventPatch = Partial<Pick<Event, (typeof REVIEW_FIELDS)[number]>>;
export type EventOverride = {
  url: string;
  reviewedAt: string;
  evidenceUrl: string;
  patch: EventPatch;
};

function httpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function preciseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/.test(value) &&
    preciseDate(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}
function evidence(value: { evidenceUrl?: unknown; verifiedAt?: unknown }): boolean {
  return httpsUrl(value.evidenceUrl) && timestamp(value.verifiedAt);
}

/** Validate facts before admitting a checked-in correction or persisted payload. */
export function validEventPatch(patch: EventPatch): boolean {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return false;
  if (Object.keys(patch).some((key) => !(REVIEW_FIELDS as readonly string[]).includes(key)))
    return false;
  for (const key of ["title", "description", "location"] as const)
    if (patch[key] !== undefined && (typeof patch[key] !== "string" || patch[key]!.trim() === ""))
      return false;
  for (const key of ["startDate", "endDate"] as const)
    if (patch[key] !== undefined && !preciseDate(patch[key])) return false;
  if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) return false;
  if (
    patch.attendance !== undefined &&
    (!patch.attendance ||
      !ATTENDANCE_POLICIES.includes(patch.attendance.policy) ||
      typeof patch.attendance.note !== "string")
  )
    return false;
  if (
    patch.lifecycle !== undefined &&
    (!patch.lifecycle ||
      !EVENT_LIFECYCLES.includes(patch.lifecycle.state) ||
      !evidence(patch.lifecycle) ||
      (patch.lifecycle.replacementDate !== undefined &&
        (!preciseDate(patch.lifecycle.replacementDate) || patch.lifecycle.state !== "postponed")) ||
      (patch.lifecycle.previousDate !== undefined &&
        (!preciseDate(patch.lifecycle.previousDate) || patch.lifecycle.state !== "postponed")))
  )
    return false;
  const replacement = patch.lifecycle?.replacementDate;
  if (
    replacement &&
    ((patch.startDate !== undefined && patch.startDate !== replacement) ||
      (patch.endDate !== undefined && patch.endDate < replacement) ||
      patch.lifecycle?.previousDate === replacement)
  )
    return false;
  if (
    patch.registration !== undefined &&
    (!patch.registration ||
      !REGISTRATION_STATES.includes(patch.registration.state) ||
      (patch.registration.state !== "unknown" && !evidence(patch.registration)) ||
      (patch.registration.evidenceUrl !== undefined && !httpsUrl(patch.registration.evidenceUrl)) ||
      (patch.registration.verifiedAt !== undefined && !timestamp(patch.registration.verifiedAt)) ||
      (patch.registration.url !== undefined && !httpsUrl(patch.registration.url)))
  )
    return false;
  if (
    patch.notices !== undefined &&
    (!patch.notices ||
      !Array.isArray(patch.notices) ||
      patch.notices.length > 20 ||
      patch.notices.some(
        (notice) =>
          !notice ||
          !EVENT_NOTICE_KINDS.includes(notice.kind) ||
          !evidence(notice) ||
          typeof notice.text !== "string" ||
          !notice.text.trim() ||
          notice.text.length > 1000,
      ))
  )
    return false;
  return true;
}
export function validateOverrides(overrides: EventOverride[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const override of overrides) {
    const key = eventUrlKey(override.url);
    if (
      !httpsUrl(override.url) ||
      !httpsUrl(override.evidenceUrl) ||
      !timestamp(override.reviewedAt) ||
      !validEventPatch(override.patch)
    )
      errors.push(`Invalid reviewed override: ${override.url}`);
    if (seen.has(key)) errors.push(`Duplicate reviewed override: ${key}`);
    seen.add(key);
  }
  return errors;
}

/** New upstream data fills ordinary fields; explicit reviewed fields require newer review evidence. */
export function mergeReviewedEvents(previous: Event, next: Event): Event {
  const merged = mergeNonEmpty(previous, next);
  const previousTime = timestamp(previous.reviewedAt) ? Date.parse(previous.reviewedAt) : -Infinity;
  const nextTime = timestamp(next.reviewedAt) ? Date.parse(next.reviewedAt) : -Infinity;
  if (previousTime !== -Infinity) {
    const nextFields = next.reviewedFields ?? REVIEW_FIELDS;
    const changedDay =
      nextTime > previousTime &&
      ((nextFields.includes("lifecycle") &&
        next.lifecycle?.replacementDate !== previous.lifecycle?.replacementDate) ||
        (nextFields.includes("startDate") && next.startDate !== previous.startDate));
    const previousFields = (previous.reviewedFields ?? REVIEW_FIELDS).filter(
      (key) => !(key === "endDate" && changedDay && !nextFields.includes("endDate")),
    );
    for (const key of previousFields)
      if (previous[key] !== undefined && (previousTime >= nextTime || !nextFields.includes(key)))
        Object.assign(merged, { [key]: previous[key] });
    merged.reviewedAt = previousTime >= nextTime ? previous.reviewedAt : next.reviewedAt;
    merged.reviewedFields =
      nextTime === -Infinity
        ? previous.reviewedFields
        : [...new Set([...previousFields, ...nextFields])];
  }
  return merged;
}

export function applyEventOverrides(event: Event, overrides: EventOverride[]): Event {
  const override = overrides.find((item) => eventUrlKey(item.url) === eventUrlKey(event.url));
  if (!override) return normalizeEventDates(event);
  if (validateOverrides([override]).length) throw new Error("Invalid reviewed event correction");
  const changedDay =
    (override.patch.lifecycle?.replacementDate !== undefined &&
      override.patch.lifecycle.replacementDate !== event.lifecycle?.replacementDate) ||
    (override.patch.startDate !== undefined && override.patch.startDate !== event.startDate);
  const retainedFields = (event.reviewedFields ?? []).filter(
    (key) => !(changedDay && override.patch.endDate === undefined && key === "endDate"),
  );
  const reviewed = normalizeEventDates(
    mergeReviewedEvents(event, {
      ...event,
      ...override.patch,
      reviewedAt: override.reviewedAt,
      reviewedFields: [
        ...new Set([
          ...retainedFields,
          ...(Object.keys(override.patch) as (typeof REVIEW_FIELDS)[number][]),
        ]),
      ],
    }),
    // Re-reviewing the same start day keeps the existing, still-valid duration.
    !changedDay,
  );
  // The patch alone cannot see the base start; check the merged range too.
  if (reviewed.endDate && reviewed.startDate && reviewed.endDate < reviewed.startDate)
    throw new Error("Invalid reviewed event correction");
  return reviewed;
}

/** A reviewed replacement day is current; an old end date is not a new duration. */
export function normalizeEventDates(event: Event, sameDay = false): Event {
  const replacement =
    event.lifecycle?.state === "postponed" ? event.lifecycle.replacementDate : undefined;
  const currentStart =
    replacement ?? (event.reviewedFields?.includes("startDate") ? event.startDate : undefined);
  if (!currentStart) return event;
  return {
    ...event,
    startDate: currentStart,
    date: currentStart,
    year: currentStart.slice(0, 4),
    endDate:
      (sameDay || event.reviewedFields?.includes("endDate")) &&
      event.endDate &&
      event.endDate >= currentStart
        ? event.endDate
        : undefined,
  };
}

export function resolveEventStatus(event: Event, today: string): Event["status"] {
  if (event.lifecycle?.state === "cancelled") return undefined;
  if (event.lifecycle?.state === "postponed" && !event.lifecycle.replacementDate) return undefined;
  const start = event.lifecycle?.replacementDate ?? event.startDate;
  if (!start) return event.status;
  const end =
    event.endDate &&
    event.endDate >= start &&
    (!event.lifecycle?.replacementDate || event.reviewedFields?.includes("endDate"))
      ? event.endDate
      : start;
  return today < start ? "upcoming" : today <= end ? "live" : undefined;
}
export function lifecycleLabel(event: Event): string {
  return event.lifecycle?.state === "cancelled"
    ? "Cancelled"
    : event.lifecycle?.state === "postponed"
      ? event.lifecycle.replacementDate
        ? "Rescheduled"
        : "Postponed — new date unknown"
      : "Scheduled";
}
export const REGISTRATION_LABELS: Record<NonNullable<Event["registration"]>["state"], string> = {
  unknown: "Registration unknown",
  "not-open": "Registration not open",
  open: "Registration open",
  closed: "Registration closed",
  "sold-out": "Sold out",
  waitlist: "Waitlist",
};
export function eventSchemaStatus(event: Pick<Event, "lifecycle">): string {
  return `https://schema.org/${event.lifecycle?.state === "cancelled" ? "EventCancelled" : event.lifecycle?.state === "postponed" ? (event.lifecycle.replacementDate ? "EventRescheduled" : "EventPostponed") : "EventScheduled"}`;
}
export function mergeReviewedCollections(
  archived: Event[],
  live: Event[],
  overrides: EventOverride[],
  today: string,
): Event[] {
  return mergeEventCollectionsByUrl(archived, live, mergeReviewedEvents).map((event) => {
    const reviewed = applyEventOverrides(event, overrides);
    return { ...reviewed, status: resolveEventStatus(reviewed, today) };
  });
}

/** Active attendance opportunities precede the historical archive before pagination. */
export function sortEventCollection(events: Event[]): Event[] {
  return events.sort(
    (a, b) =>
      Number(!a.status) - Number(!b.status) ||
      (a.status
        ? (a.startDate ?? a.year).localeCompare(b.startDate ?? b.year)
        : (b.startDate ?? b.year).localeCompare(a.startDate ?? a.year)) ||
      a.url.localeCompare(b.url),
  );
}
