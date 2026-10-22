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
  {
    year: "2026",
    date: "4–6 Oct 2026",
    title: "IEEE Edge AI Hackathon 2026",
    url: "https://edspmec.github.io/eds-pmec/hackathon.html",
    type: "Hackathon",
    location:
      "Department of Electronics & Telecommunication Engineering, PMEC, Sitalapalli, Berhampur, Odisha",
    startDate: "2026-10-04",
    endDate: "2026-10-06",
    description:
      "The onsite final of a hardware hackathon run by the IEEE EDS PMEC Student Branch Chapter and IEEE CEDA, where shortlisted teams built edge AI solutions on FPGA, Raspberry Pi/Renesas and ESP32/Arduino TinyML tracks.",
    attendance: {
      policy: "approval",
      note: "Only teams shortlisted from submitted abstracts reached the onsite final, which charged ₹1,000 per IEEE member and ₹1,200 per other participant.",
    },
  },
];
