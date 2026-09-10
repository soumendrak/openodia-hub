/**
 * AI events from SOA (OAIC)
 * Source: https://www.oaic.in/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const soaOaicEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "19–20 Dec 2026",
    title: "1st Odisha AI Conference (OAIC 2026)",
    url: "https://www.oaic.in/",
    type: "Conference",
    location: "Siksha 'O' Anusandhan University, Bhubaneswar",
    startDate: "2026-12-19",
    endDate: "2026-12-20",
    description:
      "A two-day inaugural Odisha AI Conference planned at Siksha 'O' Anusandhan University, covering AI research from theoretical foundations to applied, trustworthy and ethical systems.",
    attendance: {
      policy: "unknown",
      note: "The site publishes a full-paper submission deadline (15 Sep 2026) and an EDAS submission system for authors, but the site's Register menu item does not lead to a general-attendee registration page or terms.",
    },
  },
];
