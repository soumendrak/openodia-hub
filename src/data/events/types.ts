export const EVENT_TYPES = [
  "Conference",
  "Summit",
  "Workshop",
  "Hackathon",
  "Talk",
  "Research",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const ATTENDANCE_POLICIES = [
  "public",
  "eligibility",
  "approval",
  "restricted",
  "unknown",
] as const;

export const EVENT_LIFECYCLES = ["scheduled", "postponed", "cancelled"] as const;
export const REGISTRATION_STATES = [
  "unknown",
  "not-open",
  "open",
  "closed",
  "sold-out",
  "waitlist",
] as const;
export const EVENT_NOTICE_KINDS = [
  "venue",
  "time",
  "registration",
  "postponement",
  "cancellation",
] as const;
export type EventEvidence = { evidenceUrl: string; verifiedAt: string };
export type EventLifecycle = EventEvidence & {
  state: (typeof EVENT_LIFECYCLES)[number];
  replacementDate?: string;
  /** Original precise day only when stated in the reviewed rescheduling notice. */
  previousDate?: string;
};
export type EventRegistration = {
  state: (typeof REGISTRATION_STATES)[number];
  evidenceUrl?: string;
  verifiedAt?: string;
  url?: string;
};
export type EventNotice = EventEvidence & {
  kind: (typeof EVENT_NOTICE_KINDS)[number];
  text: string;
};

export type Event = {
  year: string;
  date: string;
  title: string;
  url: string;
  type: EventType;
  /** Populated automatically by index.ts — do not set in community data files. */
  community: string;
  /** Stable organizer identity. Additive: `community` remains the public display field. */
  organizerId?: import("../organizers").OrganizerId;
  /** Omit for past events; set to "upcoming" or "live" for active events. Will be automatically resolved from dates if not specified. */
  status?: "upcoming" | "live";
  startDate?: string; // Optional precise override YYYY-MM-DD
  endDate?: string; // Optional precise override YYYY-MM-DD
  location?: string;
  theme?: string;
  description: string;
  /**
   * Who may attend, from organizer evidence. Omit only for legacy community
   * events. Never implies registration is currently open.
   * public: explicit open invitation · eligibility: fee/ID/cap/audience rules ·
   * approval: request-to-attend/selection · restricted: staff/officials/campus
   * only · unknown: no explicit evidence.
   */
  /** Reviewed facts remain independent from date-derived status and attendance eligibility. */
  lifecycle?: EventLifecycle;
  registration?: EventRegistration;
  notices?: EventNotice[];
  /** Timestamp of a reviewed correction; never inferred from scrape time. */
  reviewedAt?: string;
  /** Per-field review timestamps, so retained fields keep their own review time. */
  reviewedTimes?: Partial<Record<NonNullable<Event["reviewedFields"]>[number], string>>;
  /** Only explicitly corrected fields are protected from unreviewed upstream writes. */
  reviewedFields?: (
    | "title"
    | "description"
    | "startDate"
    | "endDate"
    | "location"
    | "attendance"
    | "lifecycle"
    | "registration"
    | "notices"
  )[];
  attendance?: {
    policy: (typeof ATTENDANCE_POLICIES)[number];
    /** One sentence of evidence, e.g. "ID proof, fee and 60-seat cap." */
    note: string;
  };
  /** Set only when the organizer explicitly states there is no fee. */
  free?: boolean;
};
