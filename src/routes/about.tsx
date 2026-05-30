import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { MagneticButton } from "../components/MagneticButton";
import { GithubIcon, YoutubeIcon, PythonIcon } from "../components/icons";
import { ContributorGrid } from "../components/ContributorGrid";
import { ContributorLeaderboard } from "../components/ContributorLeaderboard";
import { ArrowRight, Star, Users, BookOpen } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · OpenOdia" },
      {
        name: "description",
        content:
          "OpenOdia is a community-driven ecosystem of open-source tools, datasets, and educational content for the Odia language.",
      },
      { property: "og:title", content: "About · OpenOdia" },
      {
        property: "og:description",
        content:
          "A community-driven ecosystem for the Odia language — open-source tools, datasets, and education.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "OpenOdia",
          url: "https://openodia.com",
          description:
            "Open source community building tools, datasets, and educational content for the Odia language.",
          sameAs: [
            "https://github.com/soumendrak/openodia-hub",
            "https://www.youtube.com/@openodia",
          ],
        }),
      },
    ],
  }),
  component: About,
});

const pillars = [
  {
    icon: <YoutubeIcon size={22} />,
    title: "Education",
    body: "The @openodia YouTube channel produces tutorials, talks, and demos in Odia and English — covering NLP, AI, and language technology for Odia speakers and builders.",
    href: "https://www.youtube.com/@openodia",
    cta: "Watch on YouTube",
    color: "from-magenta to-saffron",
    external: true,
  },
  {
    icon: <PythonIcon size={22} />,
    title: "Tooling",
    body: "The openodia Python package provides practical, install-and-use utilities for Odia text processing — transliteration, normalization, tokenization, and curated datasets.",
    href: "https://pypi.org/project/openodia/",
    cta: "Explore the package",
    color: "from-neon to-magenta",
    external: true,
  },
  {
    icon: <Star size={22} />,
    title: "Community",
    body: "Awesome-Odia-AI is a living, community-curated directory of 60+ Odia datasets, models, libraries, and research papers — the go-to index for anyone building with Odia.",
    href: "/tools",
    cta: "Browse the directory",
    color: "from-saffron to-neon",
  },
];

function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">About</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Open source for <span className="text-gradient">ଓଡ଼ିଆ</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          OpenOdia is a community-driven ecosystem making the Odia language — spoken by 50+ million
          people — a first-class citizen in modern AI and open-source software.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10 flex flex-wrap gap-3">
        <MagneticButton href="https://github.com/soumendrak/openodia-hub" external>
          <GithubIcon size={16} /> GitHub
        </MagneticButton>
        <MagneticButton variant="ghost" href="https://www.youtube.com/@openodia" external>
          <YoutubeIcon size={16} /> YouTube
        </MagneticButton>
      </Reveal>

      {/* Three pillars */}
      <section className="mt-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">What we build</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Three pillars — education, tooling, and community — working together for Odia.
          </p>
        </Reveal>

        <div className="mt-8 space-y-6">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-primary-foreground`}
                  >
                    {p.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                    <p className="mt-2 text-muted-foreground">{p.body}</p>
                    <div className="mt-4">
                      {p.external ? (
                        <a
                          href={p.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-neon hover:underline"
                        >
                          {p.cta} <ArrowRight size={14} />
                        </a>
                      ) : (
                        <Link
                          to={p.href}
                          className="inline-flex items-center gap-1 text-sm font-medium text-neon hover:underline"
                        >
                          {p.cta} <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-neon/10 to-magenta/10 blur-3xl"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Contribute */}
      <section className="mt-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Get involved</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            OpenOdia is open source and community-driven. Here's how you can contribute.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <GithubIcon size={18} />,
              title: "Contribute code",
              body: "Pick an issue, submit a PR, or start a discussion on GitHub. Every contribution counts.",
              href: "https://github.com/soumendrak/openodia-hub",
            },
            {
              icon: <BookOpen size={18} />,
              title: "Add to the directory",
              body: "Found a dataset, model, or tool missing from Awesome-Odia-AI? Open a PR to add it.",
              href: "https://github.com/odisha-ml/Awesome-Odia-AI",
            },
            {
              icon: <Users size={18} />,
              title: "Spread the word",
              body: "Share the projects, give talks, write tutorials — help grow the Odia AI community.",
              href: "https://www.youtube.com/@openodia",
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group block h-full rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
              >
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-neon/10 text-neon">
                  {item.icon}
                </div>
                <h3 className="font-display font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <ContributorGrid />

      <ContributorLeaderboard limit={10} />
    </div>
  );
}
