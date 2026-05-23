import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Package, Star } from "lucide-react";
import { MagneticButton } from "../components/MagneticButton";
import { Reveal } from "../components/Reveal";
import { Marquee } from "../components/Marquee";
import { FEATURED_VIDEOS, YOUTUBE_CHANNEL } from "../data/videos";
import { YoutubeIcon, GithubIcon, PythonIcon } from "../components/icons";
import { FaqSection } from "../components/FaqSection";
import { ContributorGrid } from "../components/ContributorGrid";
import { ContributorLeaderboard } from "../components/ContributorLeaderboard";
import { JsonLd, faqPageSchema, breadcrumbSchema } from "../lib/jsonld";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpenOdia — Open source for the Odia language" },
      {
        name: "description",
        content:
          "A home for open-source Odia language projects: from the OpenOdia Python package and the @openodia YouTube channel to a curated directory of Odia tools, fonts, models, and datasets.",
      },
      { property: "og:title", content: "OpenOdia — Open source for the Odia language" },
      {
        property: "og:description",
        content: "Projects, tools, and resources for the Odia language — fonts, datasets, models, libraries, and more.",
      },
    ],
  }),
  component: Home,
});

const HEADLINE = "Open source for ଓଡ଼ିଆ.";

function Home() {
  return (
    <>
      <Hero />
      <Pillars />
      <Stats />
      <Videos />
      <ContributorGrid />
      <ContributorLeaderboard limit={5} />
      <FaqSection />
      <JsonLd
        data={faqPageSchema([
          {
            question: "What is OpenOdia?",
            answer:
              "OpenOdia is a hub for Odia language open-source — a growing collection of tools, fonts, datasets, models, libraries, and resources. It spans a YouTube channel (@openodia), a Python package on PyPI, and a curated directory of Odia projects.",
          },
          {
            question: "How can I contribute to Odia open source?",
            answer:
              "You can contribute by joining the odisha-ml GitHub organization, submitting tools and projects to our directory, publishing Odia-language libraries to PyPI, creating tutorial content for @openodia, or sharing your own Odia open-source projects.",
          },
          {
            question: "What kinds of Odia tools are listed here?",
            answer:
              "Everything open source: fonts, transliterators, spell checkers, speech models, NLP libraries, datasets, dictionaries, OCR tools, games, language learning apps, and more. Browse them at openodia.com/tools.",
          },
          {
            question: "Who maintains OpenOdia?",
            answer:
              "OpenOdia is built and maintained by Soumendra Kumar Sahoo, an observability engineer at PepsiCo, with contributions from the Odia open-source community worldwide.",
          },
          {
            question: "Where can I learn about Odia language technology?",
            answer:
              "The @openodia YouTube channel features tutorials in both Odia and English covering language processing, open-source tools, font development, and more. See openodia.com/tutorials.",
          },
          {
            question: "Is OpenOdia open source?",
            answer:
              "Yes. All code is open source under the MIT license. The website is at github.com/soumendrak/openodia-hub.",
          },
          {
            question: "What is the OpenOdia Python package?",
            answer:
              "The openodia PyPI package provides practical tools for Odia language processing including transliteration, text normalization, and language detection. Install with 'pip install openodia'.",
          },
        ])}
      />
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
        A growing constellation of tools, libraries, and resources making the Odia language a
        first-class citizen in modern AI and software.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="mt-8 flex flex-wrap items-center gap-3"
      >
        <Link to="/projects">
          <MagneticButton>
            Explore projects <ArrowRight size={16} />
          </MagneticButton>
        </Link>
        <MagneticButton variant="ghost" href={YOUTUBE_CHANNEL} external>
          <YoutubeIcon size={16} /> Watch on YouTube
        </MagneticButton>
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

const pillars = [
  {
    icon: <YoutubeIcon size={22} />,
    title: "YouTube channel",
    desc: "Tutorials, talks, and demos in Odia & English covering language tech, open source, and AI.",
    href: YOUTUBE_CHANNEL,
    color: "from-magenta to-saffron",
    cta: "Visit channel",
    external: true,
  },
  {
    icon: <PythonIcon size={22} />,
    title: "OpenOdia · PyPI",
    desc: "A Python package of practical tools for the Odia language.",
    href: "/projects",
    color: "from-neon to-magenta",
    cta: "See package",
  },
  {
    icon: <Star size={22} />,
    title: "Odia Tools Directory",
    desc: "A curated, live directory of Odia fonts, datasets, models, libraries, and tools.",
    href: "/tools",
    color: "from-saffron to-neon",
    cta: "Browse tools",
  },
];

function Pillars() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold md:text-5xl">Three pillars.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Education, tooling, and community — coming together for Odia.
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
  const inner = (
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
        {p.cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </span>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-neon/20 to-magenta/20 blur-3xl"
      />
    </motion.div>
  );

  return p.external ? (
    <a href={p.href} target="_blank" rel="noreferrer" className="block h-full">
      {inner}
    </a>
  ) : (
    <Link to={p.href} className="block h-full">
      {inner}
    </Link>
  );
}

const stats = [
  { label: "OSS initiatives", value: "10+" },
  { label: "Curated tools", value: "60+" },
  { label: "Open contributors", value: "100+" },
  { label: "Years building", value: "5+" },
];

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05} className="bg-surface p-8">
            <div className="font-display text-4xl font-bold text-gradient md:text-5xl">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Videos() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold md:text-5xl">Featured videos</h2>
          <p className="mt-2 text-muted-foreground">From the @openodia channel.</p>
        </div>
        <a
          href={YOUTUBE_CHANNEL}
          target="_blank"
          rel="noreferrer"
          className="hidden text-sm text-neon hover:underline md:inline"
        >
          All videos →
        </a>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURED_VIDEOS.map((v, i) => (
          <Reveal key={i} delay={i * 0.06}>
            <a
              href={`https://www.youtube.com/watch?v=${v.id}${v.startTime ? `&t=${v.startTime}s` : ""}`}
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
                <h3 className="font-medium">{v.title}</h3>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// suppress unused import warning
void Package;
void GithubIcon;
