/**
 * Events from TensorFlow User Group Bhubaneswar (TFUG BBSR)
 * Source: https://www.tfugbbsr.in/event
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const tfugBbsrEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "11 Oct 2025",
    title: "AI Day 2025 Bhubaneswar",
    url: "https://www.tfugbbsr.in/aidaybbsr",
    type: "Workshop",
    location: "Centurion University of Technology & Management, Bhubaneswar",
    description:
      "A one-day TFUG BBSR event on the latest in artificial intelligence — expert talks, hands-on workshops, and live demos exploring how AI is shaping industries. Open to students, professionals, and enthusiasts.",
  },
  {
    year: "2025",
    date: "27 Apr – 12 Jul 2025",
    title: "Build with AI: TFUG Bhubaneswar Edition",
    url: "https://www.tfugbbsr.in/buildwithai",
    type: "Workshop",
    location: "Online & CUTM Bhubaneswar",
    description:
      "A multi-week workshop series by TFUG Bhubaneswar covering the latest advancements in AI and machine learning, with hands-on sessions designed to build practical AI development skills.",
  },
  {
    year: "2024",
    date: "27 Oct 2024",
    title: "AI Day Bhubaneswar",
    url: "https://www.tfugbbsr.in/aidaybbsr2024",
    type: "Workshop",
    location: "IIIT Bhubaneswar",
    description:
      "An in-person TFUG BBSR community day exploring AI advancements and applications with industry experts at IIIT Bhubaneswar.",
  },
  {
    year: "2024",
    date: "14 Sep 2024",
    title: "The Eras of Large Language Models",
    url: "https://www.tfugbbsr.in/event/era-of-llms",
    type: "Workshop",
    location: "IIIT Bhubaneswar",
    description:
      "An in-person TFUG BBSR deep-dive into the evolution and capabilities of large language models, with live demos and hands-on sessions on building chatbot applications.",
  },
  {
    year: "2024",
    date: "1 Sep 2024",
    title: "Build with Gemini",
    url: "https://www.tfugbbsr.in/event",
    type: "Talk",
    description:
      "A virtual TFUG BBSR session on building real-world applications with Google's Gemini models — covering practical use cases and integration techniques for developers.",
  },
  {
    year: "2024",
    date: "24 Aug 2024",
    title: "Getting Started with Gemini",
    url: "https://www.tfugbbsr.in/event",
    type: "Talk",
    description:
      "A beginner-friendly virtual TFUG BBSR session introducing Google's Gemini language models, their capabilities, and how to get started building with them.",
  },
  {
    year: "2024",
    date: "10 Aug 2024",
    title: "Applications using LLM",
    url: "https://www.tfugbbsr.in/event",
    type: "Workshop",
    location: "KIIT Bhubaneswar",
    description:
      "An in-person TFUG BBSR workshop at KIIT Bhubaneswar on building practical applications with large language models — from prompting to deployment.",
  },
  {
    year: "2024",
    date: "11 Feb 2024",
    title: "Exploring LLMs & ChatBot",
    url: "https://www.tfugbbsr.in/event",
    type: "Talk",
    description:
      "A virtual TFUG BBSR session exploring how large language models work and how to build chatbot applications on top of them.",
  },
  {
    year: "2023",
    date: "30 Sep 2023",
    title: "Keras Community Day",
    url: "https://www.tfugbbsr.in/event",
    type: "Workshop",
    description:
      "A virtual TFUG BBSR edition of the global Keras Community Day series — focused on Keras and machine learning, led by the local ML community.",
  },
  {
    year: "2023",
    date: "15 Oct 2023",
    title: "Explore TFJs",
    url: "https://www.tfugbbsr.in/event",
    type: "Workshop",
    description:
      "A virtual TFUG BBSR session exploring TensorFlow.js — enabling machine learning directly in the browser and Node.js environments.",
  },
  {
    year: "2023",
    date: "22 Jul 2023",
    title: "Google I/O Extended Bhubaneswar 2023",
    url: "https://www.tfugbbsr.in/event",
    type: "Conference",
    location: "Trident College, Bhubaneswar",
    description:
      "An in-person GDG / TFUG BBSR watch party and community event extending Google I/O 2023, held at Trident College Bhubaneswar.",
  },
];
