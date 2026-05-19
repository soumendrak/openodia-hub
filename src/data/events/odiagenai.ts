/**
 * Events from OdiaGenAI (odiagenai.org)
 * Source: https://www.odiagenai.org/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const odiagenaiEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "Jun–Jul 2025",
    title: "OdiaGenAI Workshop 2025",
    url: "https://www.odiagenai.org/workshop-2025",
    type: "Workshop",
    theme: "Empowering India Through Inclusive Generative AI",
    description:
      "A three-day workshop co-organized by OdiaGenAI, AHRC, IIT Bhubaneswar, and KIIT-DU offering hands-on training in GenAI and LLMs with a focus on Odia and underserved Indic languages. Free to attend — includes hackathon, expert talks, poster sessions, demos, and panel discussions.",
  },
  {
    year: "2024",
    date: "31 May – 2 Jun 2024",
    title: "OdiaGenAI Workshop 2024",
    url: "https://www.odiagenai.org/workshop-2024",
    type: "Workshop",
    theme: "Empowering Indic Languages Through Generative AI",
    description:
      "A three-day virtual workshop co-organized by OdiaGenAI and KIIT DU. Covered GenAI and LLMs with a special focus on low-resource Indic languages. Featured expert talks, a hackathon, poster/demo sessions, a quiz, pitch competition, and panel discussion, with speakers from leading global AI labs.",
  },
  {
    year: "2023",
    date: "2023",
    title: "OdiaGenAI Workshop 2023",
    url: "https://www.odiagenai.org/workshop-2023",
    type: "Workshop",
    description:
      "The inaugural OdiaGenAI workshop — a one-day deep-dive into Generative AI and LLMs covering overviews, instruction-set generation, fine-tuning, inference, evaluation, and RAG, with hands-on sessions. Guest speakers included researchers from NICT Japan, PWC UK, and Google DeepMind.",
  },
];
