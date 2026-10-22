import type { Event } from "./types";

export const nmietBhubaneswarEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "14–15 Oct 2026",
    title: "NexTech 2.0: Agentic AI Hackathon at NIRMIT 2.0",
    url: "https://www.nirmit.space/",
    type: "Hackathon",
    location: "NMIET Campus, Sijua, Patrapada, Bhubaneswar, Odisha",
    startDate: "2026-10-14",
    endDate: "2026-10-15",
    description:
      "A two-day Agentic AI hackathon at NMIET's NIRMIT 2.0 tech fest, focused on EdTech and regional-language accessibility, with a Day 1 mid-evaluation and Day 2 jury evaluation.",
    attendance: {
      policy: "eligibility",
      note: "Open to engineering, polytechnic, science and management students from any institution, who must bring a valid college ID.",
    },
  },
];
