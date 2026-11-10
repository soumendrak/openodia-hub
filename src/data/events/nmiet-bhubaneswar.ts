import type { Event } from "./types";

export const nmietBhubaneswarEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "12 Oct 2026",
    title: "AI Workshop at NIRMIT 2.0",
    url: "https://www.nirmit.space/events/marvel-minds",
    type: "Workshop",
    location: "Conference Hall, Academic Block, NMIET Campus, Bhubaneswar, Odisha",
    startDate: "2026-10-12",
    description:
      "A hands-on workshop by industry experts at NMIET's NIRMIT 2.0 tech fest covering deep learning, large language models and agentic AI, with live coding on participants' own laptops.",
    attendance: {
      policy: "eligibility",
      note: "Free first-come seating for engineering students, research scholars and AI enthusiasts, who must bring a laptop, a college ID, a government photo ID and a college NOC.",
    },
    free: true,
  },
  {
    year: "2026",
    date: "14–15 Oct 2026",
    title: "NexTech 2.0: Agentic AI Hackathon at NIRMIT 2.0",
    url: "https://www.nirmit.space/events/nextech",
    type: "Hackathon",
    location: "Auditorium, MBA Block, NMIET Campus, Bhubaneswar, Odisha",
    startDate: "2026-10-14",
    endDate: "2026-10-15",
    description:
      "A 24-hour agentic AI hackathon at NMIET's NIRMIT 2.0 tech fest on EdTech for regional language and geography, where Odia/Indic language localization counted for 20% of the jury score.",
    attendance: {
      policy: "approval",
      note: "Online pre-selection from a deck, architecture diagram and intro video shortlisted 50 same-college teams of 3–5, who paid ₹499 per team after selection.",
    },
  },
];
