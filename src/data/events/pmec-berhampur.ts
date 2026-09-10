/**
 * AI events from PMEC Berhampur
 * Source: https://pmec.ac.in/event/aimlcps-2-26/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const pmecBerhampurEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "19–21 Feb 2026",
    title: "AIMLCPS-2026",
    url: "https://pmec.ac.in/event/aimlcps-2-26/",
    type: "Conference",
    location: "Parala Maharaja Engineering College, Sitalapalli, Berhampur, Odisha",
    startDate: "2026-02-19",
    endDate: "2026-02-21",
    description:
      "A three-day conference at Parala Maharaja Engineering College on AI, machine learning and cyber-physical systems (AIMLCPS).",
    attendance: {
      policy: "unknown",
      note: "Registration by email is advertised; attendee categories, fee and eligibility are not published.",
    },
  },
];
