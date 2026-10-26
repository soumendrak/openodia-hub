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
      note: "The site publishes an EDAS submission system for authors (see the official site for current dates), but the site's Register menu item does not lead to a general-attendee registration page or terms.",
    },
  },
  {
    year: "2026",
    date: "20 Dec 2026",
    title: "Odisha AI Hackathon 2026",
    url: "https://www.oaic.in/program/hackathons/",
    type: "Hackathon",
    location: "Siksha 'O' Anusandhan University, Bhubaneswar",
    startDate: "2026-12-20",
    endDate: "2026-12-20",
    description:
      "The grand finale of the Odisha AI Hackathon at OAIC 2026, where 12 teams from regional rounds at four nodal centres present AI solutions across infrastructure, human well-being and future-technology tracks, with prizes worth ₹3,00,000.",
    attendance: {
      policy: "approval",
      note: "Teams of four apply through the nodal centre for their institute's district, and only the top 3 teams from each of the four regions advance to the finale.",
    },
  },
];
