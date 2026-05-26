/**
 * Events from GDG on Campus – NIT Rourkela
 * Source: https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgocNitRourkelaEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "11 Apr 2026",
    title: "Automate Your Meta Account Using Langchain and RAG",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-automate-your-meta-account-using-langchain-and-rag/",
    type: "Workshop",
    description:
      "A technical workshop by GDGoC NIT Rourkela on building automation pipelines for Meta platforms using LangChain and Retrieval-Augmented Generation — combining LLM orchestration with social media APIs.",
  },
  {
    year: "2026",
    date: "3 Apr 2026",
    title: "Ship Your Project: From Localhost to Production",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-ship-your-project-from-localhost-to-production/",
    type: "Workshop",
    description:
      "A deployment-focused workshop by GDGoC NIT Rourkela covering containerization, CI/CD, cloud hosting, and domain setup — guiding participants through the full pipeline of taking a project live.",
  },
  {
    year: "2026",
    date: "27 Mar 2026",
    title: "Explore AWS S3 Basics",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-explore-aws-s3-basics/",
    type: "Workshop",
    description:
      "A hands-on workshop by GDGoC NIT Rourkela introducing Amazon S3 — covering bucket creation, object storage, access control, and practical use cases for developers.",
  },
  {
    year: "2026",
    date: "24 Jan 2026",
    title: "Google Antigravity is Here!",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-google-antigravity-is-here/",
    type: "Talk",
    startDate: "2026-01-24",
    description:
      "A virtual inspiration session by GDGoC NIT Rourkela exploring real-world tech insights and innovation thinking — how ideas evolve into impactful solutions and how to push beyond conventional limits.",
  },
  {
    year: "2026",
    date: "3–4 Jan 2026",
    title: "HackNITR 7.0",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-sketch-code-conquer-hacknitr-70-is-here/",
    type: "Hackathon",
    location: "NIT Rourkela, Odisha",
    description:
      "The seventh edition of NIT Rourkela's flagship hackathon by GDGoC NIT Rourkela — a high-energy build sprint where teams sketched, coded, and shipped solutions across AI/ML, Web3, IoT, and open innovation tracks.",
  },
  {
    year: "2025",
    date: "8 Nov 2025",
    title: "Flag in the Blue: Ultimate Digital Treasure Hunt",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-flag-in-the-blue-the-ultimate-digital-treasure-hunt/",
    type: "Hackathon",
    description:
      "A digital treasure hunt CTF-style event by GDGoC NIT Rourkela combining cybersecurity puzzles, OSINT challenges, and cryptographic riddles for students to compete and learn hands-on security skills.",
  },
  {
    year: "2025",
    date: "Oct–Nov 2025",
    title: "The GSOC Playbook Series",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-national-institute-of-technology-rourkela-india-presents-the-gsoc-playbook-play-3/",
    type: "Workshop",
    description:
      "A three-part workshop series by GDGoC NIT Rourkela preparing students for Google Summer of Code — covering proposal writing, project scoping, open-source contribution strategies, and mock application reviews.",
  },
];
