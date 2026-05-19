export type EventType = "Conference" | "Summit" | "Workshop" | "Hackathon" | "Talk" | "Research";

export type Event = {
  year: string;
  date: string;
  title: string;
  url: string;
  type: EventType;
  /** Populated automatically by index.ts — do not set in community data files. */
  community: string;
  /** Omit for past events; set to "upcoming" or "live" for active events. Will be automatically resolved from dates if not specified. */
  status?: "upcoming" | "live";
  startDate?: string; // Optional precise override YYYY-MM-DD
  endDate?: string; // Optional precise override YYYY-MM-DD
  location?: string;
  theme?: string;
  description: string;
};
