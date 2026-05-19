import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ExternalLink, Calendar, MapPin, Search, X } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { events, YEARS, COMMUNITIES } from "../data/events";
import type { Event } from "../data/events";

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

const TYPE_COLORS: Record<Event["type"], string> = {
  Conference: "border-blue-500/40 text-blue-400",
  Summit: "border-neon/40 text-neon",
  Workshop: "border-purple-500/40 text-purple-400",
  Research: "border-amber-500/40 text-amber-400",
  Hackathon: "border-rose-500/40 text-rose-400",
  Talk: "border-sky-500/40 text-sky-400",
};

function EventCard({ event, index }: { event: Event; index: number }) {
  const isUpcoming = event.status === "upcoming";
  const isLive = event.status === "live";
  return (
    <motion.a
      href={event.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className={`group flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition ${
        isLive
          ? "border-green-500/60 hover:border-green-400"
          : isUpcoming
            ? "border-neon/50 hover:border-neon"
            : "border-border hover:border-neon/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full border border-green-500/50 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-full border border-neon/50 bg-neon/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon">
              Upcoming
            </span>
          )}
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
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();

  const upcomingEvents = events.filter((e) => e.status === "upcoming" || e.status === "live");
  const pastEvents = events.filter((e) => !e.status || e.status === "past" as string);

  const applyFilter = (list: Event[]) =>
    list.filter((e) => {
      const matchesType = activeType ? e.type === activeType : true;
      const matchesCommunity = activeCommunity ? e.community === activeCommunity : true;
      const matchesQuery = needle
        ? e.title.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle) ||
          (e.location ?? "").toLowerCase().includes(needle)
        : true;
      return matchesType && matchesCommunity && matchesQuery;
    });

  const filtered = applyFilter(events);
  const isSearching = !!needle;
  const isFiltering = !!needle || !!activeType || !!activeCommunity;

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
                onClick={() => { setQuery(""); setActiveType(null); setActiveCommunity(null); }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-neon/40 hover:text-foreground"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </Reveal>

        <Reveal>
          <select
            value={activeCommunity ?? ""}
            onChange={(e) => setActiveCommunity(e.target.value || null)}
            className="rounded-2xl border border-border bg-surface py-2.5 pl-4 pr-8 text-sm text-foreground focus:border-neon focus:outline-none"
          >
            <option value="">All communities</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Reveal>
      </div>

      {isSearching ? (
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
        <>
          {applyFilter(upcomingEvents).length > 0 && (
            <div className="mt-14">
              <Reveal>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-neon">Upcoming</h2>
                  <span className="rounded-full bg-neon/10 px-2.5 py-0.5 text-xs font-semibold text-neon">
                    {applyFilter(upcomingEvents).length}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {applyFilter(upcomingEvents).map((e, i) => (
                    <EventCard key={e.url + i} event={e} index={i} />
                  ))}
                </div>
              </Reveal>
            </div>
          )}
          <div className="mt-14 space-y-12">
            {YEARS.map((year) => {
              const yearEvents = applyFilter(pastEvents.filter((e) => e.year === year));
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
        </>
      )}
    </div>
  );
}
