/**
 * AI events from Startup Odisha
 * Source: https://startupodisha.gov.in/
 *
 * Agent-checked (no crawler adapter). Follow the "Agent-checked sources" rules in
 * .agents/skills/crawl-events/SKILL.md; every entry needs `attendance` evidence.
 */
import type { Event } from "./types";

export const startupOdishaEvents: Omit<Event, "community">[] = [
  {
    year: "2025",
    date: "1–2 Dec 2025",
    title: "Hack the Future: AI, DeepTech & IoT Innovation Challenge 2025",
    url: "https://startupodisha.gov.in/latest_events/hack-the-future-ai-deeptech-iot-innovation-challenge-2025/",
    type: "Hackathon",
    location: "Conference Hall, O-HUB Incubation Centre, Bhubaneswar",
    startDate: "2025-12-01",
    endDate: "2025-12-02",
    description:
      "A two-day hackathon at O-Hub organized by Startup Odisha challenging startups and innovators to build AI, deep-tech and IoT solutions for healthcare, agriculture and smart-cities problem statements.",
    attendance: {
      policy: "unknown",
      note: "The page is a retrospective report noting 110+ participating startups/innovators; it states no registration process, fee, or eligibility criteria.",
    },
  },
  {
    year: "2025",
    date: "21 Jun 2025",
    title: "Cloud Innovate Odisha - Startup Acceleration Day",
    url: "https://startupodisha.gov.in/latest_events/cloud-innovate-odisha-startup-acceleration-day/",
    type: "Workshop",
    location: "Tower-A, Odisha Startup Incubation Centre, O-HUB, Bhubaneswar",
    startDate: "2025-06-21",
    endDate: "2025-06-21",
    description:
      "A one-day AWS-partnered acceleration event at O-Hub with live demonstrations of Amazon Bedrock and Amazon Nova plus a hands-on generative AI workshop for startups.",
    attendance: {
      policy: "approval",
      note: "The AWS partner event page requires attendees to 'Request to attend' and targets startups; the government listing confirms the date but adds no separate registration terms.",
    },
  },
  {
    year: "2024",
    date: "11 Dec 2024",
    title: "Generative AI Workshop organized by Startup Odisha powered by AWS",
    url: "https://www.linkedin.com/posts/startupodisha_register-now-httpsshorturlat4ucw5-activity-7271146092707127296-XHQA",
    type: "Workshop",
    location: "Conference Hall, O-Hub, Chandaka Industrial Estate, Bhubaneswar",
    startDate: "2024-12-11",
    endDate: "2024-12-11",
    description:
      "A hands-on generative AI workshop at O-Hub run by Startup Odisha with AWS architects, teaching participants to build a first GenAI application.",
    attendance: {
      policy: "eligibility",
      note: "LinkedIn invitation targets developers, data scientists, engineering managers and CTOs at startups; registration via a short link and attendees must bring a laptop.",
    },
  },
];
