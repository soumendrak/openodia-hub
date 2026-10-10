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
  attendance?: {
    policy: (typeof ATTENDANCE_POLICIES)[number];
    /** One sentence of evidence, e.g. "ID proof, fee and 60-seat cap." */
    note: string;
  };
};
