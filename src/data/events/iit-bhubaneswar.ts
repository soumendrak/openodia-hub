/**
 * AI events from IIT Bhubaneswar
 * Source: https://www.iitbbs.ac.in/index.php/home/events-archives/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const iitBhubaneswarEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "25–26 Feb 2026",
    title:
      "National Conference on Technology, Finance & AI as Catalysts for Accelerating Economic Growth",
    url: "https://www.iitbbs.ac.in/index.php/national-conference-on-technology-finance-ai-as-catalysts-for-accelerating-economic-growth/",
    type: "Conference",
    location: "IIT Bhubaneswar, Argul, Khordha, Odisha",
    startDate: "2026-02-25",
    endDate: "2026-02-26",
    description:
      "A two-day national conference at IIT Bhubaneswar examining how technology, finance and AI can jointly accelerate economic growth.",
    attendance: {
      policy: "unknown",
      note: "The page title confirms the 25-26 Feb 2026 dates but gives no registration, fee, or eligibility details; a brochure is referenced but was not opened.",
    },
  },
  {
    year: "2026",
    date: "7 Feb 2026",
    title: "Workshop on Advances in Artificial Intelligence: Towards a Democratized Future",
    url: "https://www.iitbbs.ac.in/index.php/workshop-on-advances-in-artificial-intelligence-towards-a-democratized-future/",
    type: "Workshop",
    location: "IIT Bhubaneswar, Argul, Khordha, Odisha",
    startDate: "2026-02-07",
    endDate: "2026-02-07",
    description:
      "A one-day workshop at IIT Bhubaneswar on advances in artificial intelligence, framed around broadening access to AI and linked to an India AI Impact Summit brochure.",
    attendance: {
      policy: "unknown",
      note: "The event detail page lists no registration link, fee, or eligibility criteria; it is marked as a completed event.",
    },
  },
];
