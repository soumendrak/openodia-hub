import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { MagneticButton } from "../components/MagneticButton";
import { GithubIcon, YoutubeIcon, LinkedinIcon } from "../components/icons";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · Soumendra Kumar Sahoo" },
      { name: "description", content: "Soumendra Kumar Sahoo — engineer building open-source tools, datasets, and education for the Odia language." },
      { property: "og:title", content: "About · Soumendra Kumar Sahoo" },
      { property: "og:description", content: "Engineer building open-source tools and datasets for the Odia language." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Soumendra Kumar Sahoo",
          url: "https://openodia.com",
          sameAs: [
            "https://github.com/soumendrak",
            "https://www.youtube.com/@openodia",
            "https://www.linkedin.com/in/soumendrak/",
          ],
          jobTitle: "Software Engineer",
          knowsAbout: ["Odia language", "Natural Language Processing", "Open Source"],
        }),
      },
    ],
  }),
  component: About,
});

const milestones = [
  { year: "2019", title: "Started open-source Odia work", body: "Released early Odia NLP utilities and datasets on GitHub." },
  { year: "2021", title: "Launched the OpenOdia Python package", body: "A practical, install-and-use library for Odia text processing." },
  { year: "2023", title: "Curated Awesome-Odia-AI", body: "A living index of Odia datasets, models, and tools — community-driven." },
  { year: "2024", title: "@openodia on YouTube", body: "Tutorials, demos, and community spotlights for builders." },
];

function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">About</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Hi, I'm <span className="text-gradient">Soumendra</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Engineer, lifelong learner, and an Odia native. I build open-source
          software, datasets, and educational content so the Odia language —
          spoken by 50+ million people — gets the modern AI tooling it deserves.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10 flex flex-wrap gap-3">
        <MagneticButton href="https://github.com/soumendrak" external>
          <GithubIcon size={16} /> GitHub
        </MagneticButton>
        <MagneticButton variant="ghost" href="https://www.youtube.com/@openodia" external>
          <YoutubeIcon size={16} /> YouTube
        </MagneticButton>
        <MagneticButton variant="ghost" href="https://www.linkedin.com/in/soumendrak/" external>
          <LinkedinIcon size={16} /> LinkedIn
        </MagneticButton>
        <MagneticButton variant="ghost" href="mailto:proud_odia@outlook.com" external>
          <Mail size={16} /> Email
        </MagneticButton>
      </Reveal>

      <section className="mt-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            Journey so far
          </h2>
        </Reveal>

        <div className="relative mt-8 ml-3 border-l border-border pl-8">
          {milestones.map((m, i) => (
            <Reveal key={m.year} delay={i * 0.06} className="relative pb-10">
              <span className="absolute -left-[42px] top-1.5 h-3 w-3 rounded-full bg-gradient-to-br from-neon to-magenta ring-4 ring-background" />
              <div className="font-mono text-xs text-neon">{m.year}</div>
              <h3 className="mt-1 font-display text-xl font-semibold">{m.title}</h3>
              <p className="mt-1 text-muted-foreground">{m.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal delay={0.1} className="mt-16 rounded-3xl border border-border bg-surface p-8 text-center md:p-12">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">
          Sponsor the work
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Every contribution keeps Odia open-source moving. Sponsor on GitHub
          or just share the projects with someone who'd love them.
        </p>
        <div className="mt-6 flex justify-center">
          <MagneticButton href="https://github.com/sponsors/soumendrak" external>
            ❤ Sponsor on GitHub
          </MagneticButton>
        </div>
      </Reveal>
    </div>
  );
}
