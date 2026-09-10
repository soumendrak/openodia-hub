/**
 * AI events from Odisha State Open University
 * Source: https://osou.ac.in/training-programmes-fdp-workshop.html
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const osouEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "11–24 Nov 2025",
    title: 'Online Hands-on Training Programme on "AI Empowered Office"',
    url: "https://osou.ac.in/training-programmes-fdp-workshop.html",
    type: "Workshop",
    location: "Online",
    startDate: "2025-11-11",
    endDate: "2025-11-24",
    description:
      "An online hands-on training programme run by Odisha State Open University teaching AI-assisted office productivity tools and workflows.",
    attendance: {
      policy: "unknown",
      note: "The training table gives only the programme title and dates, with no registration link or stated audience/eligibility.",
    },
  },
];
