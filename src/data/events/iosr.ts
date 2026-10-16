import type { Event } from "./types";

export const iosrEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "13–16 Nov 2026",
    title: "8th National Language Conference (NLC-2026)",
    url: "https://iosrodisha.in/nlc/index.html",
    type: "Conference",
    startDate: "2026-11-13",
    endDate: "2026-11-16",
    location: "Sri Krushna Chandra Gajapati Autonomous College, Paralakhemundi, Gajapati, Odisha",
    theme: "Odia as a Language of Knowledge and Development",
    description:
      "IOSR's national conference inviting scholars, writers, language planners, and students to explore Odia through research, pedagogy, heritage, policy, and emerging technologies.",
    attendance: {
      policy: "unknown",
      note: "The conference page invites scholars, writers, language planners, and students but gives no registration, fee, or eligibility details.",
    },
  },
];
