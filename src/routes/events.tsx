import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ExternalLink, Calendar, MapPin, Search, X } from "lucide-react";
import { Reveal } from "../components/Reveal";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events · Odia AI Community" },
      {
        name: "description",
        content:
          "Past and upcoming events from the Odia AI ecosystem — conferences, workshops, and summits.",
      },
      { property: "og:title", content: "Events · Odia AI Community" },
      {
        property: "og:description",
        content: "Odia AI community events — conferences, workshops, and summits.",
      },
    ],
  }),
  component: EventsPage,
});

type Event = {
  year: string;
  date: string;
  title: string;
  url: string;
  type: "Conference" | "Summit" | "Workshop" | "Research" | "Hackathon" | "Talk";
  location?: string;
  theme?: string;
  description: string;
};

const events: Event[] = [
  {
    year: "2026",
    date: "7–8 Apr 2026",
    title: "HackForge 2.0",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-hackforge-20/cohost-gdg-bhubaneswar",
    type: "Hackathon",
    location: "Regional College of Management, Bhubaneswar",
    description:
      "A 24-hour hackathon by GDG Bhubaneswar designed for developers to tackle real-world problems, collaborate with peers, and ship meaningful code. Features mentorship from the developer community, hands-on challenges, and prizes.",
  },
  {
    year: "2026",
    date: "17–18 Jan 2026",
    title: "HackFest Bhubaneswar 2026",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-hackfest-bhubaneswar-2026/cohost-gdg-bhubaneswar",
    type: "Hackathon",
    location: "Bhubaneswar, India",
    theme: "Build the Future with AI",
    description:
      "Odisha's biggest AI + Tech hackathon, organized by GDG Bhubaneswar as the official partner of India's AI Impact Summit 2026. Participants build across AI/GenAI, Cloud, Web, Mobile, Cybersecurity, and Open Source — with top teams earning direct showcase slots at the Govt. of India's national AI platform.",
  },
  {
    year: "2025",
    date: "9 Nov 2025",
    title: "DevFest 2025 – Bhubaneswar",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-devfest-2025-bhubaneswar/cohost-gdg-bhubaneswar",
    type: "Conference",
    location: "Bhubaneswar, India",
    description:
      "GDG Bhubaneswar's annual developer festival — a full day of keynotes, hands-on workshops, and tech talks covering AI, GenAI, Flutter, Android, Web, Cloud, and Firebase. Open to students, developers, designers, entrepreneurs, and tech leaders.",
  },
  {
    year: "2025",
    date: "27 Sep 2025",
    title: "Code, Grow, Thrive",
    url: "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-code-grow-thrive-level-up-your-coding-skills-and-powered-life-after-corporate/",
    type: "Talk",
    description:
      "A virtual GDG Bhubaneswar speaker session on writing clean, test-driven code and building a life beyond the corporate 9–5 — covering freelancing, entrepreneurship, and continuous learning for developers at all levels.",
  },
  {
    year: "2025",
    date: "21–22 Dec 2025",
    title: "Odisha AI Summit 2025",
    url: "https://www.odishaai.org/conferences/summit/",
    type: "Summit",
    location: "Bhubaneswar, India",
    theme: "AI-First, AI-Everywhere",
    description:
      "The global crescendo of Odisha AI — a gathering of educators, policymakers, industry practitioners, entrepreneurs, and investors charting Odisha's AI implementation path. Co-organized with OSA's Higher Education Division.",
  },
  {
    year: "2025",
    date: "14 Nov 2025",
    title: "Odisha AI Regional Summit Series 2025",
    url: "https://www.odishaai.org/conferences/regional-summit/",
    type: "Summit",
    location: "Bhubaneswar, India",
    description:
      "Regional summits acting as tributaries to the main Odisha AI Summit. Educators, practitioners, entrepreneurs, and policymakers from across Odisha's regions chart a locally-grounded AI path aligned with state and national policy.",
  },
  {
    year: "2025",
    date: "11 Oct 2025",
    title: "2025 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2025/",
    type: "Conference",
    theme: "Imagining Odisha as the intellectual AI capital of the globe",
    description:
      "The sixth annual international congregation of Odias in AI — a full-day virtual gathering of academicians, policymakers, linguists, business executives, investors, and entrepreneurs working to advance AI for Odia communities.",
  },
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
    url: "https://www.tfugbbsr.in/event",
    type: "Workshop",
    location: "Online & CUTM Bhubaneswar",
    description:
      "A multi-week workshop series by TFUG Bhubaneswar covering the latest advancements in AI and machine learning, with hands-on sessions designed to build practical AI development skills.",
  },
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
    date: "5 Oct 2024",
    title: "2024 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2024/",
    type: "Conference",
    theme: "GenAI Now. What's next?",
    description:
      "The fifth international congregation of Odias in AI/ML, featuring local chapter conferences simultaneously held across cities worldwide alongside the main virtual conference. Explored the state and future of generative AI.",
  },
  {
    year: "2024",
    date: "27 Oct 2024",
    title: "AI Day Bhubaneswar",
    url: "https://www.tfugbbsr.in/event",
    type: "Workshop",
    location: "IIIT Bhubaneswar",
    description:
      "An in-person TFUG BBSR community day exploring AI advancements and applications with industry experts at IIIT Bhubaneswar.",
  },
  {
    year: "2024",
    date: "14 Sep 2024",
    title: "The Eras of Large Language Models",
    url: "https://www.tfugbbsr.in/event",
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
  {
    year: "2023",
    date: "2023",
    title: "OdiaGenAI Workshop 2023",
    url: "https://www.odiagenai.org/workshop-2023",
    type: "Workshop",
    description:
      "The inaugural OdiaGenAI workshop — a one-day deep-dive into Generative AI and LLMs covering overviews, instruction-set generation, fine-tuning, inference, evaluation, and RAG, with hands-on sessions. Guest speakers included researchers from NICT Japan, PWC UK, and Google DeepMind.",
  },
  {
    year: "2023",
    date: "Oct 2023",
    title: "2023 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2023/",
    type: "Conference",
    theme: "Inclusive Growth through AI — Building Action Plan 2030",
    description:
      "The fourth international congregation of Odias in AI/ML, bringing together techies, academicians, policymakers, linguists, business executives, and entrepreneurs focused on an inclusive, long-term AI roadmap for Odisha.",
  },
  {
    year: "2022",
    date: "1 Oct 2022",
    title: "2022 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2022/",
    type: "Conference",
    theme: "Building Growth Engines for ଓଡ଼ିଶା, Leveraging AI",
    description:
      "The third international congregation of Odias in AI/ML. Invited speakers, panel discussions, posters, and a full conference agenda focused on leveraging AI to build economic and social growth engines for Odisha.",
  },
  {
    year: "2021",
    date: "9 Oct 2021",
    title: "2021 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2021/",
    type: "Conference",
    theme: "Act! The Future is Here",
    description:
      "The second global conference of the Odisha AI community. A call to action for Odia technologists, researchers, and policymakers to move from awareness to implementation in AI adoption.",
  },
  {
    year: "2020",
    date: "4 Oct 2020",
    title: "2020 Odisha AI Conference",
    url: "https://www.odishaai.org/conferences/2020/",
    type: "Conference",
    theme: "The Future is Now: Are you Ready?",
    description:
      "The inaugural global conference of the Odisha AI community — the first international congregation of Odias working in AI/ML, setting the stage for an annual tradition of knowledge-sharing and collaboration.",
  },
];

const YEARS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020"] as const;

const TYPE_COLORS: Record<Event["type"], string> = {
  Conference: "border-blue-500/40 text-blue-400",
  Summit: "border-neon/40 text-neon",
  Workshop: "border-purple-500/40 text-purple-400",
  Research: "border-amber-500/40 text-amber-400",
  Hackathon: "border-rose-500/40 text-rose-400",
  Talk: "border-sky-500/40 text-sky-400",
};

function EventCard({ event, index }: { event: Event; index: number }) {
  return (
    <motion.a
      href={event.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TYPE_COLORS[event.type]}`}
          >
            {event.type}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar size={11} />
            {event.date}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={11} />
              {event.location}
            </span>
          )}
        </div>
        <ExternalLink
          size={13}
          className="mt-0.5 shrink-0 text-muted-foreground transition group-hover:text-neon"
        />
      </div>

      <h3 className="font-display text-base font-semibold leading-snug">{event.title}</h3>

      {event.theme && (
        <p className="text-xs italic text-neon/80">&ldquo;{event.theme}&rdquo;</p>
      )}

      <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
    </motion.a>
  );
}

const ALL_TYPES = ["Conference", "Summit", "Workshop", "Hackathon", "Talk", "Research"] as const;

function EventsPage() {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<Event["type"] | null>(null);

  const needle = query.trim().toLowerCase();

  const filtered = events.filter((e) => {
    const matchesType = activeType ? e.type === activeType : true;
    const matchesQuery = needle
      ? e.title.toLowerCase().includes(needle) ||
        e.description.toLowerCase().includes(needle) ||
        (e.location ?? "").toLowerCase().includes(needle)
      : true;
    return matchesType && matchesQuery;
  });

  const isFiltering = !!needle || !!activeType;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Community</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia AI <span className="text-gradient">Events</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Conferences, workshops, hackathons, and talks from the Odia AI ecosystem — past and
          upcoming. Sourced from{" "}
          <a href="https://www.odishaai.org/conferences/" target="_blank" rel="noreferrer" className="text-neon hover:underline">odishaai.org</a>
          {", "}
          <a href="https://www.odiagenai.org/" target="_blank" rel="noreferrer" className="text-neon hover:underline">odiagenai.org</a>
          {", "}
          <a href="https://www.tfugbbsr.in/event" target="_blank" rel="noreferrer" className="text-neon hover:underline">tfugbbsr.in</a>
          {", and "}
          <a href="https://gdg.community.dev/gdg-bhubaneswar/" target="_blank" rel="noreferrer" className="text-neon hover:underline">GDG Bhubaneswar</a>
          .
        </p>
      </Reveal>

      <div className="mt-10 space-y-4">
        <Reveal>
          <div className="relative max-w-xl">
            <Search
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              placeholder="Search events…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </Reveal>

        <Reveal>
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(activeType === type ? null : type)}
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition ${
                  activeType === type
                    ? TYPE_COLORS[type] + " bg-surface-2"
                    : "border-border text-muted-foreground hover:border-neon/40 hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
            {isFiltering && (
              <button
                onClick={() => { setQuery(""); setActiveType(null); }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-neon/40 hover:text-foreground"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {isFiltering ? (
        <div className="mt-10">
          <Reveal>
            <p className="text-sm text-muted-foreground">
              {filtered.length} event{filtered.length !== 1 ? "s" : ""} matched
            </p>
          </Reveal>
          {filtered.length === 0 ? (
            <p className="mt-6 text-muted-foreground">No events matched.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {filtered.map((e, i) => <EventCard key={e.url + i} event={e} index={i} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-14 space-y-12">
          {YEARS.map((year) => {
            const yearEvents = events.filter((e) => e.year === year);
            if (yearEvents.length === 0) return null;
            return (
              <Reveal key={year}>
                <h2 className="font-display text-2xl font-bold text-neon/80">{year}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {yearEvents.map((e, i) => (
                    <EventCard key={e.url + i} event={e} index={i} />
                  ))}
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
