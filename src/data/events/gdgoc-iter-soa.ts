/**
 * Events from GDG on Campus – ITER SOA University, Bhubaneswar
 * Source: https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgocIterSoaEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "15 Dec 2025",
    title: "Cybersecurity Essentials: A 3-Day Online Workshop",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india-presents-cybersecurity-essentials-a-3-day-online-workshop/",
    type: "Workshop",
    description:
      "A 3-day virtual workshop by GDGoC ITER SOA University covering cybersecurity fundamentals — threat landscapes, secure coding practices, and hands-on labs for students and developers.",
  },
  {
    year: "2025",
    date: "4 Nov 2025",
    title: "IdeaSprint",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india-presents-ideasprint/",
    type: "Hackathon",
    location: "ITER SOA University, Bhubaneswar",
    description:
      "A structured ideathon by GDGoC ITER SOA University challenging participants to devise creative solutions using AI tools or programming technologies within a constrained timeframe, encouraging interdisciplinary thinking and hands-on prototyping.",
  },
  {
    year: "2025",
    date: "3 Nov 2025",
    title: "LogicQuest – Competitive Coding Contest",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india-presents-logicquest-competitive-coding-contest/",
    type: "Hackathon",
    location: "ITER SOA University, Bhubaneswar",
    description:
      "An in-person competitive coding contest by GDGoC ITER SOA University evaluating participants' problem-solving abilities in Data Structures and Algorithms, structured across difficulty tiers aligned to different academic years.",
  },
];
