/**
 * AI events from Fakir Mohan University
 * Source: https://fmuniversity.nic.in/dept_notice?dept_id=12
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const fakirMohanUniversityEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "9–10 Jan 2026",
    title:
      "National Conference on Emerging Trends in Artificial Intelligence and Digital Systems (ET-AIDS 2026)",
    url: "https://fmuniversity.nic.in/getdata?dir=deptnotice&rid=notice2568_11220261770797313921.pdf",
    type: "Conference",
    location: "Fakir Mohan University, Vyasa Vihar, Balasore, Odisha",
    startDate: "2026-01-09",
    endDate: "2026-01-10",
    description:
      "A two-day national conference held by Fakir Mohan University's PG Department of Computer Science on emerging trends in AI and digital systems, featuring keynotes on multimodal and explainable AI and thirteen peer-reviewed paper presentations.",
    attendance: {
      policy: "unknown",
      note: "The document is a post-event report confirming the conference was held academically (academicians, researchers, professionals and students in attendance); no general public registration process or fee is stated.",
    },
  },
];
