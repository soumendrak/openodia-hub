/**
 * AI events from NIT Rourkela
 * Source: https://www.nitrkl.ac.in/CS/ClosedWorkshops/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const nitRourkelaEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "18–22 May 2026",
    title:
      "ANRF Sponsored National Workshop on Edge Intelligence: Demystifying the intersection of Edge Computing and Artificial Intelligence",
    url: "https://www.nitrkl.ac.in/docs/Workshop/CS/20042026164724551B.pdf",
    type: "Workshop",
    location: "NIT Rourkela, Odisha",
    startDate: "2026-05-18",
    endDate: "2026-05-22",
    description:
      "A five-day national workshop by NIT Rourkela's CS department on integrating edge computing with AI, covering LLM use in IoT/edge settings and applications in healthcare, manufacturing and smart cities.",
    attendance: {
      policy: "eligibility",
      note: "Registration is fee-based by category (industry/R&D Rs.3540, academic faculty Rs.2360, UG/PG/PhD students Rs.1180) via a Google Form, with fee covering materials and food.",
    },
  },
  {
    year: "2026",
    date: "13–17 Apr 2026",
    title: "Five-Days National Workshop on AI-Driven Advanced Manufacturing for Industry 5.0",
    url: "https://www.nitrkl.ac.in/docs/Workshop/ME/26032026191212007B.pdf",
    type: "Workshop",
    location: "Online",
    startDate: "2026-04-13",
    endDate: "2026-04-17",
    description:
      "A five-day virtual national workshop by NIT Rourkela's Mechanical Engineering department applying AI/ML to additive and advanced manufacturing under the Industry 5.0 paradigm.",
    attendance: {
      policy: "eligibility",
      note: "Open to faculty, research scholars, UG/PG students, technical staff and industry/R&D personnel; fee Rs.354 (academic) or Rs.590 (industry); registration deadline 12 Apr 2026.",
    },
  },
  {
    year: "2026",
    date: "16–20 Mar 2026",
    title: "A Hands-on Workshop on Computational Approaches in Engineering Problems with AI/ML",
    url: "https://www.nitrkl.ac.in/docs/Workshop/ME/13032026113144434B.pdf",
    type: "Workshop",
    location: "Online",
    startDate: "2026-03-16",
    endDate: "2026-03-20",
    description:
      "A five-day online workshop jointly run by NIT Rourkela's Mechanical and Electronics & Communication departments, applying AI/ML and computational techniques to structural, seismic, control and RF/communication engineering problems.",
    attendance: {
      policy: "eligibility",
      note: "Fee-based (Rs.499 student, Rs.899 faculty, Rs.1299 industry; NIT Rourkela students/staff exempt); open to UG/PG/MS/PhD students, faculty and industry professionals; registration deadline 15 Mar 2026.",
    },
  },
  {
    year: "2026",
    date: "7–16 Feb 2026",
    title: "Problem-Driven AI: Real-World Applications and Solution Frameworks",
    url: "https://www.nitrkl.ac.in/docs/Workshop/CS/04022026105152319B.pdf",
    type: "Workshop",
    location: "Online",
    startDate: "2026-02-07",
    endDate: "2026-02-16",
    description:
      "A free, fully online workshop by NIT Rourkela's CS department teaching a problem-first approach to applying AI and deep learning (CNNs, RNNs, transformers, deployment), run as an AI Impact Summit 2026 pre-summit activity.",
    attendance: {
      policy: "public",
      note: "No registration fee; open to UG/PG students, research scholars, faculty and industry professionals via a Google Form, though prior registration is mandatory.",
    },
  },
];
