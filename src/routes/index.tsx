import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Boxes, Database, Users } from "lucide-react";
import { MagneticButton } from "../components/MagneticButton";
import { Reveal } from "../components/Reveal";
import { Marquee } from "../components/Marquee";
import { FEATURED_VIDEOS } from "../data/videos";
import { YoutubeIcon } from "../components/icons";
import { FaqSection, FAQS } from "../components/FaqSection";
import { ContributorGrid } from "../components/ContributorGrid";
import { ContributorLeaderboard } from "../components/ContributorLeaderboard";
import { JsonLd, faqPageSchema, breadcrumbSchema } from "../lib/jsonld";
import { withDeadline } from "../lib/fetch-utils";
import { pageHead } from "../lib/seo";
import { loadAwesome } from "../lib/sources/awesome";
import { loadRepos } from "../lib/sources/repos";
import { loadDatasets, loadModels } from "../lib/sources/huggingface";

/**
 * Ecosystem counts for the hero stats — the numbers the hub is actually about.
 * Every source is read through the shared cache, and a source that's down
 * simply drops out rather than showing a wrong number.
 */
const STATS_DEADLINE_MS = 6000;

/**
 * Ecosystem counts for the hero stats — the numbers the hub is actually about.
 *
 * Every source is read through the shared cache, so in steady state this is
 * free. On a cold cache each source gets a deadline and drops its tile rather
 * than holding the home page open behind a 150-repo fan-out; the directory
 * pages populate the same cache, so the tiles fill in.
 */
const getEcosystemStats = createServerFn({ method: "GET" }).handler(async () => {
  const none = { value: null as number | null, approx: false };
  const count = (items: unknown[] | null) => (items === null ? null : items.length);

  const [awesome, repos, models, datasets] = await Promise.all([
    withDeadline(loadAwesome(), STATS_DEADLINE_MS, null),
    withDeadline(loadRepos(), STATS_DEADLINE_MS, null),
    withDeadline(loadModels(), STATS_DEADLINE_MS, null),
    withDeadline(loadDatasets(), STATS_DEADLINE_MS, null),
  ]);

  const curated = count(awesome);
  const repoCount = count(repos);
  // "+" when the page cap stopped the fetch — the count is a floor, not a total.
  const page = (p: { items: unknown[]; truncated: boolean } | null) =>
    p === null ? none : { value: p.items.length, approx: p.truncated };

  return {
    projects: curated === null && repoCount === null ? null : (curated ?? 0) + (repoCount ?? 0),
    models: page(models),
    datasets: page(datasets),
  };
});

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      path: "",
      title: "OpenOdia — Open source for the Odia language",
      description:
        "The hub for open-source Odia: a directory of tools and libraries, a live registry of Odia models and datasets, and the community teaching and building with them.",
      ogDescription:
        "Open-source repos, tools, datasets, models, libraries, fonts, and resources for the Odia language.",
    }),
  loader: () => getEcosystemStats(),
  staleTime: 60 * 60 * 1000,
  component: Home,
});

const HEADLINE = "Open source for ଓଡ଼ିଆ.";

function Home() {
  return (
    <>
      <Hero />
      <Pillars />
      <Stats />
      <CommunityVideos />
      <ContributorGrid />
      <ContributorLeaderboard limit={5} />
      <FaqSection />
      <JsonLd data={faqPageSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", url: "https://openodia.com" }])} />
      <Marquee
        items={[
          "OpenOdia",
          "Fonts",
          "Datasets",
          "Models",
          "Transliteration",
          "Libraries",
          "Tools",
          "Open Source",
        ]}
      />
    </>
  );
}

function Hero() {
  const words = HEADLINE.split(" ");
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-12 md:pt-20">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-md"
      >
        <Sparkles size={14} className="text-neon" />
        Open source community for the Odia language
      </motion.span>

      <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl lg:text-8xl">
        {words.map((w, i) => (
          <motion.span
            key={i}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 90,
              damping: 14,
              delay: 0.15 + i * 0.08,
            }}
            className="mr-3 inline-block"
          >
            {w === "ଓଡ଼ିଆ." ? <span className="text-gradient">{w}</span> : w}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-6 max-w-2xl text-lg text-muted-foreground"
      >
        A growing constellation of tools, libraries, models, and datasets — built by the Odia
        community to make ଓଡ଼ିଆ a first-class citizen in modern AI and software.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="mt-8 flex flex-wrap items-center gap-3"
      >
        {/* Both CTAs point into the ecosystem — the hub is the directory, not
            any one project inside it. */}
        <Link to="/tools">
          <MagneticButton>
            Explore the directory <ArrowRight size={16} />
          </MagneticButton>
        </Link>
        <Link to="/models">
          <MagneticButton variant="ghost">
            <Boxes size={16} /> Browse models & datasets
          </MagneticButton>
        </Link>
      </motion.div>

      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        className="pointer-events-none absolute right-4 top-12 hidden text-[18rem] font-display font-bold leading-none text-neon/10 md:block animate-float"
      >
        ଓ
      </motion.div>
    </section>
  );
}

/**
 * Ecosystem pillars, not project properties: every individual project — the
 * openodia PyPI package and the @openodia channel included — is an entry
 * inside one of these, not a pillar of its own.
 */
const pillars = [
  {
    icon: <Boxes size={22} />,
    title: "Tools & libraries",
    desc: "Fonts, keyboards, transliterators, spell checkers, OCR, NLP toolkits and apps — curated from Awesome-Odia-AI and the Odia GitHub organisations.",
    href: "/tools",
    color: "from-saffron to-neon",
    cta: "Browse the directory",
  },
  {
    icon: <Database size={22} />,
    title: "Models & datasets",
    desc: "A live registry of every Odia-tagged model and dataset on Hugging Face, with licenses, sizes, and ready-to-paste citations.",
    href: "/models",
    color: "from-neon to-magenta",
    cta: "Open the registry",
  },
  {
    icon: <Users size={22} />,
    title: "Community & learning",
    desc: "Tutorials and talks from OdiaGenAI, OpenOdia, Odias in ML and TFUG Bhubaneswar, plus the community's meetups and conferences.",
    href: "/tutorials",
    color: "from-magenta to-saffron",
    cta: "Start learning",
  },
] as const;

function Pillars() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold md:text-5xl">One ecosystem.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Many maintainers, many organisations — gathered into three places to look.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <PillarCard {...p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PillarCard(p: (typeof pillars)[number]) {
  return (
    <Link to={p.href} className="block h-full">
      <motion.div
        whileHover={{ y: -6, rotate: -0.4 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6"
      >
        <div
          className={`mb-5 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-primary-foreground`}
        >
          {p.icon}
        </div>
        <h3 className="font-display text-xl font-semibold">{p.title}</h3>
        <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.desc}</p>
        <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-neon">
          {p.cta}{" "}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </span>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-neon/20 to-magenta/20 blur-3xl"
        />
      </motion.div>
    </Link>
  );
}

function Stats() {
  const { projects, models, datasets } = Route.useLoaderData();

  // Counts come from the same sources the directories render, so the hero can't
  // contradict the pages it links to. A source that's down drops its tile
  // rather than showing a stale claim.
  const tiles = [
    { label: "Projects listed", value: projects, approx: false, href: "/tools" },
    { label: "Odia models", value: models.value, approx: models.approx, href: "/models" },
    { label: "Odia datasets", value: datasets.value, approx: datasets.approx, href: "/datasets" },
    { label: "Community channels", value: 4, approx: false, href: "/tutorials" },
  ] as const;
  const shown = tiles.filter((t) => t.value !== null);

  if (shown.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {shown.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05} className="bg-surface">
            <Link to={s.href} className="block p-8 transition hover:bg-surface-2">
              <div className="font-display text-4xl font-bold text-gradient md:text-5xl">
                {s.value}
                {s.approx ? "+" : ""}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

type CommunityVideo = { id: string; title: string; channelName: string; published?: string };

/**
 * The rail draws from every community channel the tutorials page aggregates,
 * not just one. The static list is the fallback while the feed loads or if it
 * is unreachable.
 */
function CommunityVideos() {
  const { data } = useQuery({
    queryKey: ["home", "community-videos"],
    queryFn: async () => {
      const r = await fetch("/api/videos");
      if (!r.ok) throw new Error("videos");
      return (await r.json()) as {
        channels: { name: string; videos: { id: string; title: string; published: string }[] }[];
      };
    },
    staleTime: 60 * 60 * 1000,
  });

  const live: CommunityVideo[] = (data?.channels ?? [])
    .flatMap((c) => c.videos.map((v) => ({ ...v, channelName: c.name })))
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
    .slice(0, 3);

  const videos: CommunityVideo[] =
    live.length === 3
      ? live
      : FEATURED_VIDEOS.map((v) => ({ id: v.id, title: v.title, channelName: "OpenOdia" }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold md:text-5xl">From the community</h2>
          <p className="mt-2 text-muted-foreground">
            Latest from the Odia AI channels — OdiaGenAI, OpenOdia, Odias in ML, TFUG Bhubaneswar.
          </p>
        </div>
        <Link to="/tutorials" className="hidden text-sm text-neon hover:underline md:inline">
          All tutorials →
        </Link>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {videos.map((v, i) => (
          <Reveal key={v.id} delay={i * 0.06}>
            <a
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                  alt={v.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-neon to-magenta text-primary-foreground">
                    <YoutubeIcon size={22} />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium leading-tight">{v.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{v.channelName}</p>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
