/**
 * Events from GDG on Campus – VSSUT Burla
 * Source: https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/
 *
 * To add a new event, append an entry to the array below.
 * Keep entries newest-first within each year.
 */
import type { Event } from "./types";

export const gdgocVssutBurlaEvents: Omit<Event, "community">[] = [
  {
    year: "2026",
    date: "15 Mar 2026",
    title: "Build with AI: Intro Solution Challenge",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india-presents-build-with-ai-intro-solution-challenge/",
    type: "Workshop",
    location: "VSSUT Burla, Odisha",
    description:
      "An introductory session by GDGoC VSSUT Burla on the Google Solution Challenge, guiding participants through problem identification, solution design, and building impactful projects using Google technologies.",
  },
  {
    year: "2026",
    date: "24–25 Jan 2026",
    title: "Dev Talk & Workshop: Networking with Industry Experts",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india-presents-dev-talk-and-workshop-networking-with-industry-experts/",
    type: "Workshop",
    location: "VSSUT Burla, Odisha",
    description:
      "A two-day event by GDGoC VSSUT Burla combining a tech talk and hands-on workshop with industry experts, offering students direct mentorship, career guidance, and practical project experience.",
  },
  {
    year: "2025",
    date: "22 Oct 2025",
    title: "Cloud Study Jam: Hands-On Cloud Computing Session",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india-presents-cloud-study-jam-hands-on-cloud-computing-session/",
    type: "Workshop",
    location: "VSSUT Burla, Odisha",
    description:
      "A hands-on Cloud Study Jam by GDGoC VSSUT Burla covering Google Cloud fundamentals, hands-on labs, and guided exercises to build cloud skills for students and developers.",
  },
  {
    year: "2025",
    date: "30 Sep 2025",
    title: "Kickoff Session: GDG on Campus at VSSUT",
    url: "https://gdg.community.dev/events/details/google-gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india-presents-kickoff-session-gdg-on-campus-at-vssut/",
    type: "Workshop",
    location: "VSSUT Burla, Odisha",
    description:
      "The launch event for GDGoC VSSUT Burla's 2025-26 chapter year — introducing the chapter mission, upcoming events, study jams, hackathons, and ways for students to get involved.",
  },
];
