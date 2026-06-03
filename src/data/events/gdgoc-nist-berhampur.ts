/**
 * Events from GDG on Campus – NIST University, Berhampur
 * Source: https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgocNistBerhampurEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "29 Mar 2025",
    title: "Build with AI: Gemini Workshop",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-build-with-ai-gemini-workshop/",
    type: "Talk",
    description:
      "Join us for the Build with AI – Gemini Workshop, where you'll learn to create AI-powered chatbots using Gemini and Gradio. Gain hands-on skills in prompt engineering, API integration, and UI design.",
  },

  {
    year: "2026",
    date: "23 May 2026",
    title: "Agent Forge — Build with Google ADK",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-agent-forge-build-with-google-adk-gdgoc-nist-berhampur/",
    type: "Hackathon",
    status: "upcoming",
    location: "NIST University, Berhampur, Odisha",
    description:
      "A 3-hour hands-on AI Agent building competition by GDGoC NIST Berhampur. Participants use Google's Agent Development Kit (ADK) and Gemini to build a working AI agent from scratch — solo. Open to all branches and years; winners receive special Google swags.",
  },
  {
    year: "2026",
    date: "31 Jan 2026",
    title: "ATLAS – GDG NIST On Campus Hackathon: Final Evaluation",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-atlas-gdg-nist-on-campus-hackathon-final-evaluation/",
    type: "Hackathon",
    description:
      "The concluding virtual phase of the ATLAS hackathon at GDGoC NIST Berhampur. Shortlisted teams presented and demoed their solutions to an evaluation panel, judged on innovation, technical implementation, scalability, real-world impact, and presentation clarity.",
  },
  {
    year: "2026",
    date: "31 Jan 2026",
    title: "ATLAS – Final Results & Top 3 Winner Announcement",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-atlas-final-results-amp-top-3-winner-announcement/",
    type: "Talk",
    description:
      "The official closing session of the ATLAS GDGoC NIST hackathon — announcing final results, declaring the Top 3 winning teams based on evaluation outcomes, and recognising all participants and organizers who contributed to the event.",
  },
  {
    year: "2026",
    date: "19 Jan 2026",
    title: "Hands-on Workshop: Building AI Agents with ADK",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-hands-on-workshop-building-ai-agents-with-adk/",
    type: "Workshop",
    description:
      "A 60-minute virtual GDGoC NIST workshop on building agentic AI systems with Google's Agent Development Kit (ADK). Participants built agents that reason, call tools, and act intelligently using Python — moving beyond traditional chatbots.",
  },
  {
    year: "2025",
    date: "6 Sep 2025",
    title: "Intelligent Horizons: RAG, Cloud, and AI",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-science-and-technology-berhampur-india-presents-intelligent-horizons-rag-cloud-and-ai-workshop/",
    type: "Workshop",
    location: "NIST University, Berhampur",
    description:
      "An advanced in-person workshop at GDGoC NIST Berhampur covering Retrieval-Augmented Generation (RAG), Cloud Computing, and AI. Blended conceptual learning, live demos, and project-based practice — attended by 150+ participants.",
  },
];
