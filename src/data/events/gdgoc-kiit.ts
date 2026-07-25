/**
 * Events from GDG on Campus – KIIT University, Bhubaneswar
 * Source: https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgocKiitEvents: Omit<Event, "community">[] = [
  // auto-crawled
  {
    year: "2026",
    date: "8–9 Aug 2026",
    title: "Deploy or Die",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-deploy-or-die/",
    type: "Hackathon",
    location: "KIIT School of Computer Science and Engineering (New Block) Campus -25",
    startDate: "2026-08-08",
    endDate: "2026-08-09",
    description:
      "Deploy or Die is three good things happening back to back — a talk worth showing up for, a hackathon worth losing sleep over, and something you genuinely won't get to do anywhere else: hunting for real asteroids.",
  },
  {
    year: "2025",
    date: "31 Mar 2025",
    title: "Droid Day",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-droid-day/",
    type: "Workshop",
    description:
      "GDG KIIT is back with Android Dev Kickstart! Join us for a beginner-friendly workshop on Kotlin, Jetpack Compose, and Android app development. Get hands-on experience and start your journey in mobile development with us!",
  },
  {
    year: "2025",
    date: "25 Mar 2025",
    title: "GDG SecLabs - Session 2",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-gdg-seclabs-session-2-2025-03-25/",
    type: "Workshop",
    description:
      "Join us for an exciting and interactive workshop on the Basics of Cybersecurity, led by our CyberSec domain expert! In t.",
  },
  {
    year: "2025",
    date: "26 Jan 2025",
    title: "Overthinking -- The Nature of Intelligence and Reasoning",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-overthinking-the-nature-of-intelligence-and-reasoning-1/",
    type: "Workshop",
    description:
      "Join us at GDG KIIT’s 'Overthinking-- The Nature of Intelligence and Reasoning,' and think over the intricacies of reasoning in LLMs.",
  },
  {
    year: "2024",
    date: "25 Oct 2024",
    title: "GenAI Study Jam Virtual Session",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-genai-study-jam-virtual-session/",
    type: "Workshop",
    description:
      "Build with AI, this time's Gen AI Study Jam will soon be over. Join us for a virtual session where we'll guide you through the entire course, solve your doubts and queries and we can all have a discussion of our progress.",
  },
  {
    year: "2024",
    date: "15 Oct 2024",
    title: "Hacktoberfest",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-hacktoberfest/",
    type: "Talk",
    description:
      "Discover the power of open source! Join us as we explore its importance in education and career advancement. Learn how open source enriches student experiences and opens doors to future opportunities.",
  },

  {
    year: "2026",
    date: "28 Feb 2026",
    title: "Breaking an LLM",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-breaking-an-llm/",
    type: "Workshop",
    location: "KIIT University, Bhubaneswar",
    description:
      "A high-intensity mechanistic interpretability workshop by GDGoC KIIT: dissect LLM internals, identify hallucination circuits, visualize safety breaches via live jailbreak demos, and perform hands-on activation steering via Google Colab.",
  },
  {
    year: "2025",
    date: "2 Nov 2025",
    title: "Building Bad",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-building-bad/",
    type: "Hackathon",
    location: "KIIT University, Bhubaneswar",
    description:
      "An in-person hackathon by GDGoC KIIT challenging participants to build a tech empire from scratch — multi-stage challenges testing creativity, precision, and grit from concept to deployment.",
  },
  {
    year: "2025",
    date: "16 Oct 2025",
    title: "Cloud Study Jam Virtual Session",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-cloud-study-jam-virtual-session/",
    type: "Workshop",
    description:
      "A virtual GDGoC KIIT Cloud Study Jam covering Google Cloud fundamentals with guided hands-on labs and speaker sessions for students new to cloud computing.",
  },
  {
    year: "2025",
    date: "14 Jun 2025",
    title: "Debunking Myths of Undergraduate AI Research",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-debunking-myths-of-undergraduate-ai-research/",
    type: "Talk",
    description:
      "A virtual GDGoC KIIT speaker session demystifying AI research for undergraduates — addressing what good research means, career paths, and real-world expectations, hosted by incoming research engineer interns at Birla and TCS Research.",
  },
];
