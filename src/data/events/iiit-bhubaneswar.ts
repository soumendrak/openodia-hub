/**
 * AI events from IIIT Bhubaneswar
 * Source: https://www.iiit-bh.ac.in/category/workshops/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const iiitBhubaneswarEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "7–11 Jul 2026",
    title: "DLAI-10: International Workshop on Deep Learning & Artificial Intelligence",
    url: "https://www.iiit-bh.ac.in/workshops/dlai10-10th-international-workshop-on-deep-learning-ai-july-7-11-2026/",
    type: "Workshop",
    location: "Hybrid — IIIT Bhubaneswar",
    startDate: "2026-07-07",
    endDate: "2026-07-11",
    description:
      "A five-day hybrid workshop at IIIT Bhubaneswar covering deep learning and AI foundations and applications across domains, from classification to generative AI.",
    attendance: {
      policy: "eligibility",
      note: "Open to students, academics and industry professionals with foundational ML/AI knowledge; requires ID proof, fee payment and is capped at 60 seats. Registration deadline (29 Jun 2026) has passed.",
    },
  },
  {
    year: "2026",
    date: "26–27 Mar 2026",
    title: "Short Term Program on Recent Trends in AI and Cyber Security",
    url: "https://www.iiit-bh.ac.in/workshops/short-term-program-on-recent-trends-in-ai-and-cybersecurity/",
    type: "Workshop",
    location: "IIIT Bhubaneswar",
    startDate: "2026-03-26",
    endDate: "2026-03-27",
    description:
      "A two-day short-term program at IIIT Bhubaneswar under the ISEA Phase-3 initiative covering AI-driven threat detection, adversarial AI and privacy-preserving security techniques.",
    attendance: {
      policy: "eligibility",
      note: "Open to B.Tech (3rd/4th yr), M.Tech and PhD students, faculty, and industry cybersecurity professionals; registration window 27 Feb-20 Mar 2026 with a selection-intimation step.",
    },
  },
  {
    year: "2026",
    date: "10–14 Feb 2026",
    title:
      "Bootcamp on Cybersecurity and Information Security in Industry 4.0 with Cryptology, Machine Learning and Federated Learning",
    url: "https://www.iiit-bh.ac.in/workshops/bootcamp-on-cybersecurity-and-information-security-in-industry-4-0-with-cryptology-machine-learning-and-federated-learning/",
    type: "Workshop",
    location: "IIIT Bhubaneswar",
    startDate: "2026-02-10",
    endDate: "2026-02-14",
    description:
      "A five-day bootcamp at IIIT Bhubaneswar on cybersecurity and information security in Industry 4.0, incorporating cryptology, machine learning and federated learning.",
    attendance: {
      policy: "unknown",
      note: "The detail page gives only the title and dates; eligibility, fee and registration details sit in a separate linked PDF that was not opened.",
    },
  },
];
