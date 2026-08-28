import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { MagneticButton } from "../components/MagneticButton";
import { GithubIcon, YoutubeIcon } from "../components/icons";
import { ContributorGrid } from "../components/ContributorGrid";
import { ContributorLeaderboard } from "../components/ContributorLeaderboard";
import { ArrowRight, Boxes, Database, Users, BookOpen } from "lucide-react";
import { pageHead } from "../lib/seo";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";

export const Route = createFileRoute("/about")({
  head: () => ({
    ...pageHead({
      path: "about",
      title: "About · OpenOdia",
      description:
        "OpenOdia is a community-driven ecosystem of open-source tools, datasets, and educational content for the Odia language.",
      ogDescription:
        "A community-driven ecosystem for the Odia language — open-source tools, datasets, and education.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "OpenOdia",
          url: "https://openodia.com",
          description:
            "Community hub for open-source Odia: tools and libraries, models and datasets, tutorials and events.",
          sameAs: [
            "https://github.com/soumendrak/openodia-hub",
            "https://github.com/odisha-ml",
            "https://github.com/OdiaGenAI",
            "https://github.com/OdiaNLP",
            "https://github.com/OdiaWikimedia",
          ],
        }),
      },
    ],
  }),
  component: About,
});

/**
 * The same three ecosystem pillars as the home page. Individual projects —
 * `openodia` on PyPI, the @openodia channel, OdiaGenAI's models — are entries
 * inside these, not pillars of their own.
 */
const pillars = [
  {
    icon: <Boxes size={22} />,
    title: "Tools & libraries",
    body: "Fonts, keyboards, transliterators, spell checkers, OCR, NLP toolkits, and apps from across the ecosystem — OdiaNLP, OdiaWikimedia, Odia-Digital, openodia (PyPI), and dozens of independent maintainers.",
    href: "/tools",
    cta: "Browse the directory",
    color: "from-saffron to-neon",
  },
  {
    icon: <Database size={22} />,
    title: "Models & datasets",
    body: "A live registry of every Odia-tagged model and dataset on Hugging Face — OdiaGenAI's LLMs and ASR, AI4Bharat's corpora, community fine-tunes — each with its license, size, and a citation.",
    href: "/models",
    cta: "Open the registry",
    color: "from-neon to-magenta",
  },
  {
    icon: <Users size={22} />,
    title: "Community & learning",
    body: "Tutorials and talks from OdiaGenAI, OpenOdia, Odias in ML, and TFUG Bhubaneswar, plus the meetups and conferences the Odisha AI community runs.",
    href: "/tutorials",
    cta: "Start learning",
    color: "from-magenta to-saffron",
  },
];

function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "About", url: "https://openodia.com/about" },
        ])}
      />
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">About</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Open source for <span className="text-gradient">ଓଡ଼ିଆ</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          OpenOdia is a community hub for the Odia language — spoken by 50+ million people — and the
          open-source work making it a first-class citizen in modern AI and software. It was started
          by Soumendra Kumar Sahoo and is maintained by the community: OdiaGenAI, OdiaNLP,
          OdiaWikimedia, Odisha AI, Odia-Digital, and many independent maintainers.
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
          <h2 className="font-display text-3xl font-semibold md:text-4xl">What's here</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Many maintainers, many organisations — gathered into three places to look.
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
                      <Link
                        to={p.href}
                        className="inline-flex items-center gap-1 text-sm font-medium text-neon hover:underline"
                      >
                        {p.cta} <ArrowRight size={14} />
                      </Link>
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
            The hub is open source and the ecosystem it lists is community-owned. Here's how to join
            in.
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
              body: "Missing a dataset, model, or tool? Open a PR on Awesome-Odia-AI with its license, size, and task — it appears here on the next refresh.",
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
