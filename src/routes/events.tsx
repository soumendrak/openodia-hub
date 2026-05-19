import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ExternalLink, Calendar } from "lucide-react";
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

const events = [
  {
    year: "2025",
    title: "OdiaGenAI Generative AI Workshop",
    url: "https://www.odiagenai.org/workshop-2025",
    type: "Workshop",
  },
  {
    year: "2025",
    title: "Odisha AI Summit",
    url: "https://odishaaisummit.org/",
    type: "Conference",
  },
  {
    year: "2025",
    title: "WAT 2025 — English-Indic Multimodal Translation",
    url: "https://ufal.mff.cuni.cz/wat2025english-indicmultimodaltranslation",
    type: "Conference",
  },
  { year: "2024", title: "ICON 2024", url: "https://au-kbc.org/icon2024/", type: "Conference" },
  {
    year: "2024",
    title: "Odisha AI Conference",
    url: "https://odishaaisummit.org/",
    type: "Conference",
  },
  {
    year: "2023",
    title: "Odisha AI Summit",
    url: "https://www.youtube.com/live/KZB9bfKkLgM?si=3i9eY22xT-1yZTD8",
    type: "Conference",
  },
  {
    year: "2022",
    title: "Odisha AI Summit",
    url: "https://www.youtube.com/live/MPrU-3s8ccw?si=gxbOFyfI3j3g8UsH",
    type: "Conference",
  },
  {
    year: "2022",
    title: "OdiaGenAI Workshop",
    url: "https://youtube.com/playlist?list=PLQCNXbSwgbGwMW4rGHr_LIfSCMh-7lgbR&si=f_b94K73yVAKST1E",
    type: "Workshop",
  },
  {
    year: "2021",
    title: "Odisha AI Summit",
    url: "https://www.youtube.com/live/iX59_YJzINs?si=TiZmMMeB6Hy28JcZ",
    type: "Conference",
  },
  {
    year: "2020",
    title: "Odisha AI Summit",
    url: "https://www.youtube.com/live/PF5DScCr5SI?si=znfuwHbrIgHSzgnO",
    type: "Conference",
  },
  {
    year: "2020",
    title: "Olive — Instruction Following LLaMA for Odia (IEEE)",
    url: "https://github.com/OdiaGenAI/Olive",
    type: "Research",
  },
];

function EventsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Community</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Odia AI <span className="text-gradient">Events</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Conferences, workshops, and summits from the Odia AI ecosystem — past and upcoming.
          Curated from&nbsp;
          <a
            href="https://github.com/odisha-ml/Awesome-Odia-AI"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            Awesome-Odia-AI
          </a>
          ,
          <a
            href="https://odishaai.org"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            {" "}
            Odisha AI
          </a>
          , and&nbsp;
          <a
            href="https://odiagenai.org"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            OdiaGenAI
          </a>
          .
        </p>
      </Reveal>

      <div className="mt-12 space-y-4">
        {["2025", "2024", "2023", "2022", "2021", "2020"].map((year) => {
          const yearEvents = events.filter((e) => e.year === year);
          if (yearEvents.length === 0) return null;
          return (
            <Reveal key={year}>
              <div className="group">
                <h2 className="font-display text-2xl font-bold text-neon/80">{year}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {yearEvents.map((e, i) => (
                    <motion.a
                      key={`${e.title}-${i}`}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.04 }}
                      whileHover={{ y: -3 }}
                      className="group/card flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
                    >
                      <Calendar size={20} className="mt-0.5 shrink-0 text-neon" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {e.type}
                          </span>
                          <ExternalLink
                            size={12}
                            className="shrink-0 text-muted-foreground transition group-hover/card:text-neon"
                          />
                        </div>
                        <h3 className="mt-2 font-display text-base font-semibold leading-tight">
                          {e.title}
                        </h3>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
