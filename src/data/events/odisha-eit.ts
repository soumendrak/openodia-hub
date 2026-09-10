/**
 * AI events from Odisha E&IT / OCAC
 * Source: https://ocac.in/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const odishaEitEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "18–20 Dec 2025",
    title: "Regional AI Impact Conference, Odisha",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2205412&lang=2&reg=48",
    type: "Conference",
    location: "Bhubaneswar, Odisha",
    startDate: "2025-12-18",
    endDate: "2025-12-20",
    description:
      "A three-day state government conference in Bhubaneswar organized by the Electronics & IT Department as an official precursor to the India AI Impact Summit 2026, showcasing Odisha's AI deployments in governance, healthcare, education and agriculture.",
    attendance: {
      policy: "unknown",
      note: "The PIB curtain-raiser (17 Dec 2025) confirms the conference and a co-located IndiaAI Working Group Meeting for Union/State government, academia and industry stakeholders, but states no general-public registration route.",
    },
  },
];
