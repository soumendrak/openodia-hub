/**
 * Events from GDG Bhubaneswar
 * Source: https://gdg.community.dev/gdg-bhubaneswar/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgBhubaneswarEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "7–8 Apr 2026",
    title: "HackForge 2.0",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-hackforge-20/cohost-gdg-bhubaneswar",
    type: "Hackathon",
    location: "Regional College of Management, Bhubaneswar",
    description:
      "A 24-hour hackathon by GDG Bhubaneswar designed for developers to tackle real-world problems, collaborate with peers, and ship meaningful code. Features mentorship from the developer community, hands-on challenges, and prizes.",
  },
  {
    year: "2026",
    date: "17–18 Jan 2026",
    title: "HackFest Bhubaneswar 2026",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-hackfest-bhubaneswar-2026/cohost-gdg-bhubaneswar",
    type: "Hackathon",
    location: "Bhubaneswar, India",
    theme: "Build the Future with AI",
    description:
      "Odisha's biggest AI + Tech hackathon, organized by GDG Bhubaneswar as the official partner of India's AI Impact Summit 2026. Participants build across AI/GenAI, Cloud, Web, Mobile, Cybersecurity, and Open Source — with top teams earning direct showcase slots at the Govt. of India's national AI platform.",
  },
  {
    year: "2025",
    date: "9 Nov 2025",
    title: "DevFest 2025 – Bhubaneswar",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-devfest-2025-bhubaneswar/cohost-gdg-bhubaneswar",
    type: "Conference",
    location: "Bhubaneswar, India",
    description:
      "GDG Bhubaneswar's annual developer festival — a full day of keynotes, hands-on workshops, and tech talks covering AI, GenAI, Flutter, Android, Web, Cloud, and Firebase. Open to students, developers, designers, entrepreneurs, and tech leaders.",
  },
  {
    year: "2025",
    date: "27 Sep 2025",
    title: "Code, Grow, Thrive",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-code-grow-thrive-level-up-your-coding-skills-and-powered-life-after-corporate/",
    type: "Talk",
    description:
      "A virtual GDG Bhubaneswar speaker session on writing clean, test-driven code and building a life beyond the corporate 9–5 — covering freelancing, entrepreneurship, and continuous learning for developers at all levels.",
  },
];
