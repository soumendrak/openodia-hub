import type { Event } from "./types";

export const aicNitfEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "28–29 Nov 2026",
    title: "Innovate Odisha 3.0",
    url: "https://innovateodisha.aicnitf.in/",
    type: "Hackathon",
    location: "Atal Incubation Centre - Nalanda Institute of Technology Foundation, Bhubaneswar",
    startDate: "2026-11-28",
    endDate: "2026-11-29",
    description:
      "A 24-hour student prototype hackathon where teams build solutions to local Odisha problems across five themes using AI, IoT, AR/VR, drones and AVGC, with incubation and cash prizes of up to ₹1,00,000.",
    attendance: {
      policy: "approval",
      note: "Same-college teams of 3–5 B.Sc, BE/B.Tech, MBA or MCA students in Odisha, including at least one woman, pay ₹500 per team by the extended 7 Nov 2026 deadline, and 30 finalist teams are selected for the finale.",
    },
  },
];
