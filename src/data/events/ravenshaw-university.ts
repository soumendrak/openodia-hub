/**
 * AI events from Ravenshaw University
 * Source: https://ravenshawuniversity.ac.in/eventreportdisp.php
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const ravenshawUniversityEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "20 Feb 2026",
    title: "AI & ML: Changing the Paradigm of Technology",
    url: "https://ravenshawuniversity.ac.in/eventreportdisp.php",
    type: "Talk",
    location: "Ravenshaw University, Cuttack",
    startDate: "2026-02-20",
    endDate: "2026-02-20",
    description:
      "A national-level seminar organized by Ravenshaw University's Information Technology Management department on how AI and ML are reshaping technology.",
    attendance: {
      policy: "unknown",
      note: "The page lists this as a scheduled academic event with convenor/coordinator names but no registration link or eligibility criteria.",
    },
  },
];
