import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Calendar, MapPin, Search, X, Rss, ChevronDown } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { events } from "../data/events";
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

      {event.theme && <p className="text-xs italic text-neon/80">&ldquo;{event.theme}&rdquo;</p>}

      <p className="text-sm leading-relaxed text-muted-foreground">{event.description}</p>
    </motion.a>
  );
}

const ALL_TYPES = ["Conference", "Summit", "Workshop", "Hackathon", "Talk", "Research"] as const;

const getISTDateString = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

const getEventMonthName = (e: Event): string => {
  if (e.startDate) {
    const parts = e.startDate.split("-");
    if (parts.length >= 2) {
      const monthNum = parseInt(parts[1], 10);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      if (monthNum >= 1 && monthNum <= 12) {
        return months[monthNum - 1];
      }
    }
  }

  const lowerDate = e.date.toLowerCase();
  const months = [
    { name: "January", key: "jan" },
    { name: "February", key: "feb" },
    { name: "March", key: "mar" },
    { name: "April", key: "apr" },
    { name: "May", key: "may" },
    { name: "June", key: "jun" },
    { name: "July", key: "jul" },
    { name: "August", key: "aug" },
    { name: "September", key: "sep" },
    { name: "October", key: "oct" },
    { name: "November", key: "nov" },
    { name: "December", key: "dec" },
  ];
  const found = months.find((m) => lowerDate.includes(m.key));
  if (found) return found.name;

  return "Other";
};

function EventsPage() {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<Event["type"] | null>(null);
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const isProgrammaticScroll = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const { data: liveData } = useQuery({
    queryKey: ["liveEvents"],
    queryFn: async () => {
      const r = await fetch("/api/events");
      if (!r.ok) throw new Error("Failed to fetch live events");
      return r.json() as Promise<{ events: Event[] }>;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const fetchedEvents = liveData?.events || [];

  const allMergedEventsMap = new Map<string, Event>();

  events.forEach((e) => {
    allMergedEventsMap.set(e.url, e);
  });

  fetchedEvents.forEach((e) => {
    const existing = allMergedEventsMap.get(e.url);
    if (existing) {
      allMergedEventsMap.set(e.url, {
        ...existing,
        ...e,
      });
    } else {
      allMergedEventsMap.set(e.url, e);
    }
  });

  const today = getISTDateString();
  const mergedEventsList = Array.from(allMergedEventsMap.values())
    .map((e) => {
      let status = e.status;
      if (e.startDate) {
        const end = e.endDate || e.startDate;
        if (today < e.startDate) {
          status = "upcoming";
        } else if (today >= e.startDate && today <= end) {
          status = "live";
        } else {
          status = undefined; // past event
        }
      }
      return { ...e, status };
    })
    .sort((a, b) => {
      const yearDiff = Number(b.year) - Number(a.year);
      if (yearDiff !== 0) return yearDiff;
      if (a.startDate && b.startDate) {
        return b.startDate.localeCompare(a.startDate);
      }
      if (a.startDate) return -1;
      if (b.startDate) return 1;
      return 0;
    });

  const needle = query.trim().toLowerCase();

  const upcomingEvents = mergedEventsList.filter(
    (e) => e.status === "upcoming" || e.status === "live",
  );
  const pastEvents = mergedEventsList.filter((e) => !e.status || e.status === ("past" as string));

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

  const filtered = applyFilter(mergedEventsList);
  const isSearching = !!needle;
  const isFiltering = !!needle || !!activeType || !!activeCommunity;

  const filteredPastEvents = filtered.filter((e) => !e.status || e.status === "past");
  const filteredUpcomingEvents = filtered.filter(
    (e) => e.status === "upcoming" || e.status === "live",
  );

  const dynamicYears = [...new Set(filteredPastEvents.map((e) => e.year))].sort(
    (a, b) => Number(b) - Number(a),
  );

  const dynamicCommunities = [...new Set(mergedEventsList.map((e) => e.community))].sort();

  // For each year, gather the active months in the filtered past events
  const activeMonthsByYear = new Map<string, string[]>();
  dynamicYears.forEach((year) => {
    const yearEvents = filteredPastEvents.filter((e) => e.year === year);
    const months = [...new Set(yearEvents.map(getEventMonthName))];
    activeMonthsByYear.set(year, months);
  });

  const yearsStr = JSON.stringify(dynamicYears);
  const monthsStr = JSON.stringify(Array.from(activeMonthsByYear.entries()));

  useEffect(() => {
    if (isSearching) return;

    const parsedYears: string[] = JSON.parse(yearsStr);
    const parsedMonthsMap = new Map<string, string[]>(JSON.parse(monthsStr));

    const getTargets = () => {
      const list: HTMLElement[] = [];
      const upcomingEl = document.getElementById("upcoming-events");
      if (upcomingEl) list.push(upcomingEl);

      parsedYears.forEach((year) => {
        const yearEl = document.getElementById(`year-${year}`);
        if (yearEl) list.push(yearEl);

        const months = parsedMonthsMap.get(year) || [];
        months.forEach((month) => {
          const monthEl = document.getElementById(`month-${year}-${month.toLowerCase()}`);
          if (monthEl) list.push(monthEl);
        });
      });
      return list;
    };

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;

      const targets = getTargets();
      if (targets.length === 0) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // Top of page edge case
      if (scrollTop < 80) {
        setActiveSection("upcoming-events");
        return;
      }

      // Bottom of page edge case
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setActiveSection(targets[targets.length - 1].id);
        return;
      }

      // Standard scroll spy: find the last element whose top is <= 160px
      let activeId = targets[0].id;
      for (let i = 0; i < targets.length; i++) {
        const rect = targets[i].getBoundingClientRect();
        if (rect.top <= 160) {
          activeId = targets[i].id;
        } else {
          break; // since targets are ordered down the page, we can stop
        }
      }
      setActiveSection(activeId);
    };

    // Run once initially to set correct state on load
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isSearching, yearsStr, monthsStr]);

  let activeYear: string | null = null;
  let activeMonth: string | null = null;
  let isUpcomingActive = false;

  if (activeSection === "upcoming-events") {
    isUpcomingActive = true;
  } else if (activeSection?.startsWith("year-")) {
    activeYear = activeSection.replace("year-", "");
  } else if (activeSection?.startsWith("month-")) {
    const parts = activeSection.split("-");
    if (parts.length >= 3) {
      activeYear = parts[1];
      const mLower = parts[2];
      activeMonth = mLower.charAt(0).toUpperCase() + mLower.slice(1);
    }
  }

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      isProgrammaticScroll.current = true;
      setActiveSection(id);

      // Safe release of programmatic scroll lock with a longer safety timeout (1500ms)
      timeoutRef.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 1500);

      const lenis = (
        window as unknown as {
          lenis?: {
            scrollTo: (
              target: HTMLElement,
              options?: { offset?: number; onComplete?: () => void },
            ) => void;
          };
        }
      ).lenis;
      if (lenis) {
        lenis.scrollTo(el, {
          offset: -112,
          onComplete: () => {
            // Delay the release of programmatic scroll lock to allow late scroll events to settle
            setTimeout(() => {
              isProgrammaticScroll.current = false;
            }, 150);
          },
        });
      } else {
        const rect = el.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 112;
        window.scrollTo({
          top: targetY,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Community</p>
        <h1 className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-display text-5xl font-bold md:text-7xl">
          <span>
            Odia AI <span className="text-gradient">Events</span>
          </span>
          <a
            href="/events-feed"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-orange-500 hover:text-orange-400 transition-all duration-300 hover:scale-110 active:scale-95"
            title="Subscribe to RSS Feed of Events"
          >
            <Rss className="h-7 w-7 md:h-10 md:w-10" />
          </a>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Conferences, workshops, hackathons, and talks from the Odia AI ecosystem — past and
          upcoming. Sourced from{" "}
          <a
            href="https://www.odishaai.org/conferences/"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            odishaai.org
          </a>
          {", "}
          <a
            href="https://www.odiagenai.org/"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            odiagenai.org
          </a>
          {", "}
          <a
            href="https://www.tfugbbsr.in/event"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            tfugbbsr.in
          </a>
          {", and "}
          <a
            href="https://gdg.community.dev/gdg-bhubaneswar/"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            GDG Bhubaneswar
          </a>
          .
        </p>
      </Reveal>

      <div className="mt-10">
        <Reveal>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[280px] max-w-xl">
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

            {/* Communities Dropdown */}
            <div className="relative w-full sm:w-[200px]">
              <select
                value={activeCommunity ?? ""}
                onChange={(e) => setActiveCommunity(e.target.value || null)}
                className="block w-full appearance-none rounded-2xl border border-border bg-surface py-3 pl-4 pr-10 text-sm text-foreground focus:border-neon focus:outline-none cursor-pointer hover:border-border/80"
              >
                <option value="">All communities</option>
                {dynamicCommunities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            {/* Event Types Dropdown */}
            <div className="relative w-full sm:w-[200px]">
              <select
                value={activeType ?? ""}
                onChange={(e) =>
                  setActiveType((e.target.value as (typeof ALL_TYPES)[number]) || null)
                }
                className="block w-full appearance-none rounded-2xl border border-border bg-surface py-3 pl-4 pr-10 text-sm text-foreground focus:border-neon focus:outline-none cursor-pointer hover:border-border/80"
              >
                <option value="">All event types</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            {/* Clear Button */}
            {isFiltering && (
              <button
                onClick={() => {
                  setQuery("");
                  setActiveType(null);
                  setActiveCommunity(null);
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground hover:border-neon/40 hover:text-foreground transition"
              >
                <X size={13} /> Clear Filters
              </button>
            )}
          </div>
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
              {filtered.map((e, i) => (
                <EventCard key={e.url + i} event={e} index={i} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-14 flex items-start gap-12">
          {/* Sticky Vertical Timeline Ruler Sidebar */}
          {(filteredUpcomingEvents.length > 0 || dynamicYears.length > 0) && (
            <div className="hidden lg:block w-48 shrink-0 sticky top-28 self-start border border-border bg-surface/40 backdrop-blur-md rounded-2xl p-5 shadow-lg">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground mb-4">
                Timeline
              </h3>
              <div className="relative flex flex-col gap-3">
                {/* Vertical axis line */}
                <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-border/40" />

                {/* Upcoming Node */}
                {filteredUpcomingEvents.length > 0 && (
                  <div
                    onClick={() => scrollToId("upcoming-events")}
                    className="flex items-center cursor-pointer group relative py-1 pl-8"
                  >
                    <div
                      className={`absolute left-[11px] w-2.5 h-2.5 rounded-full border bg-background z-10 transition-all duration-300 ${
                        isUpcomingActive
                          ? "border-neon bg-neon scale-125 glow"
                          : "border-border group-hover:border-neon/60"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
                        isUpcomingActive
                          ? "text-neon font-bold"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      Upcoming
                    </span>
                  </div>
                )}

                {/* Year Nodes */}
                {dynamicYears.map((year) => {
                  const isActiveYear = activeYear === year;
                  const months = activeMonthsByYear.get(year) || [];

                  return (
                    <div key={year} className="flex flex-col">
                      <div
                        onClick={() => scrollToId(`year-${year}`)}
                        className="flex items-center cursor-pointer group relative py-1 pl-8"
                      >
                        <div
                          className={`absolute left-[11px] w-2.5 h-2.5 rounded-full border bg-background z-10 transition-all duration-300 ${
                            isActiveYear
                              ? "border-neon bg-neon scale-125 glow"
                              : "border-border group-hover:border-neon/60"
                          }`}
                        />
                        <span
                          className={`text-sm font-semibold tracking-tight transition-colors duration-300 ${
                            isActiveYear
                              ? "text-foreground font-bold"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {year}
                        </span>
                      </div>

                      {/* Sub-months accordion */}
                      <AnimatePresence initial={false}>
                        {isActiveYear && months.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden flex flex-col gap-2 py-1.5"
                          >
                            {months.map((month) => {
                              const isMonthActive = activeMonth === month;
                              return (
                                <div
                                  key={month}
                                  onClick={() => scrollToId(`month-${year}-${month.toLowerCase()}`)}
                                  className="flex items-center cursor-pointer group/month relative py-0.5 pl-8"
                                >
                                  <div
                                    className={`absolute left-[13px] w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                      isMonthActive
                                        ? "bg-neon glow scale-125"
                                        : "bg-muted-foreground/30 group-hover/month:bg-neon/60"
                                    }`}
                                  />
                                  <span
                                    className={`text-xs transition-colors duration-300 ${
                                      isMonthActive
                                        ? "text-neon font-medium"
                                        : "text-muted-foreground group-hover/month:text-foreground"
                                    }`}
                                  >
                                    {month}
                                  </span>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events Grid Content Area */}
          <div className="flex-1 min-w-0 pb-[85vh]">
            {filteredUpcomingEvents.length > 0 && (
              <div id="upcoming-events" className="scroll-mt-28 mb-16">
                <Reveal>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-neon">Upcoming</h2>
                    <span className="rounded-full bg-neon/10 px-2.5 py-0.5 text-xs font-semibold text-neon">
                      {filteredUpcomingEvents.length}
                    </span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {filteredUpcomingEvents.map((e, i) => (
                      <EventCard key={e.url + i} event={e} index={i} />
                    ))}
                  </div>
                </Reveal>
              </div>
            )}

            {filteredPastEvents.length > 0 && (
              <Reveal>
                <div className="mb-8 flex items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-muted-foreground">
                    Past Events
                  </h2>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {filteredPastEvents.length}
                  </span>
                </div>
              </Reveal>
            )}

            <div className="space-y-16">
              {dynamicYears.map((year) => {
                const yearEvents = filteredPastEvents.filter((e) => e.year === year);
                if (yearEvents.length === 0) return null;

                // Group events of this year by month
                const monthsMap = new Map<string, Event[]>();
                yearEvents.forEach((e) => {
                  const mName = getEventMonthName(e);
                  const current = monthsMap.get(mName) || [];
                  current.push(e);
                  monthsMap.set(mName, current);
                });

                return (
                  <div key={year} id={`year-${year}`} className="scroll-mt-28 space-y-8">
                    <Reveal>
                      <div className="border-b border-border/40 pb-2">
                        <h2 className="font-display text-3xl font-bold text-neon/90">{year}</h2>
                      </div>
                    </Reveal>
                    <div className="space-y-10">
                      {Array.from(monthsMap.entries()).map(([monthName, evs]) => {
                        const monthId = `month-${year}-${monthName.toLowerCase()}`;
                        return (
                          <div key={monthName} id={monthId} className="scroll-mt-28 space-y-4">
                            <Reveal>
                              <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground/80 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-neon/60" />
                                {monthName}
                              </h3>
                            </Reveal>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {evs.map((e, i) => (
                                <EventCard key={e.url + i} event={e} index={i} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
