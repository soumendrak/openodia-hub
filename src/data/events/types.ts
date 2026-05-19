export type EventType =
  | "Conference"
  | "Summit"
  | "Workshop"
  | "Hackathon"
  | "Talk"
  | "Research";

export type Event = {
  year: string;
  date: string;
  title: string;
  url: string;
  type: EventType;
  /** Omit for past events; set to "upcoming" or "live" for active events. */
  status?: "upcoming" | "live";
  location?: string;
  theme?: string;
  description: string;
};
