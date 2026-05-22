import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Star, ArrowRight, Search, X } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon, PythonIcon } from "../components/icons";
import { JsonLd, breadcrumbSchema, itemListSchema } from "../lib/jsonld";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects · OpenOdia" },
      {
        name: "description",
        content: "OpenOdia Python package and other open-source Odia language projects.",
      },
      { property: "og:title", content: "Projects · OpenOdia" },
      {
        property: "og:description",
        content: "OpenOdia Python package and other open-source Odia language projects.",
      },
    ],
  }),
  component: ProjectsPage,
});

type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  created_at: string;
  topics?: string[];
};

function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Projects", url: "https://openodia.com/projects" },
        ])}
      />
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Projects</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">Built in the open.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          From a Python package to community datasets — every project here is MIT-licensed and
          contribution-ready.
        </p>
      </Reveal>

      <OpenOdiaHero />
      <RepoGrid />
    </div>
  );
}

function OpenOdiaHero() {
  const { data } = useQuery({
    queryKey: ["pypi"],
    queryFn: async () => {
      const r = await fetch("/api/pypi");
      if (!r.ok) throw new Error("pypi");
      return r.json() as Promise<{ version: string; summary: string; releases: number }>;
    },
  });
  const [copied, setCopied] = useState(false);
  const cmd = "uv add openodia";

  return (
    <Reveal delay={0.1} className="mt-14">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs">
              <PythonIcon size={14} className="text-neon" />
              PyPI · v{data?.version ?? "0.1.x"}
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
              <span className="text-gradient">openodia</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              {data?.summary ??
                "A Python package of practical tools for the Odia language — transliteration, normalization, datasets, and more."}
            </p>

            <ul className="mt-6 grid gap-2 text-sm text-muted-foreground">
              {[
                "Romanization & transliteration",
                "Numeric and date utilities",
                "Tokenization & normalization",
                "Curated Odia datasets",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon" /> {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://github.com/soumendrak/openodia"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                <GithubIcon size={16} /> GitHub
              </a>
              <a
                href="https://pypi.org/project/openodia/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-neon hover:text-neon"
              >
                <ExternalLink size={16} /> PyPI
              </a>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-border bg-background/60 p-1 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-saffron/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-neon/70" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">terminal</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
                <span className="text-muted-foreground"># Install</span>
                {"\n"}
                <span className="text-neon">$</span> {cmd}
                {"\n\n"}
                <span className="text-muted-foreground"># Use</span>
                {"\n"}
                <span className="text-magenta">from</span> openodia{" "}
                <span className="text-magenta">import</span> transliterator
                {"\n"}
                transliterator.<span className="text-saffron">to_odia</span>(
                <span className="text-neon">"odia bhasha"</span>){"\n"}
                <span className="text-muted-foreground"># → ଓଡ଼ିଆ ଭାଷା</span>
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cmd);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="m-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-neon hover:text-neon"
              >
                <Copy size={12} /> {copied ? "Copied!" : "Copy command"}
              </button>
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-neon/20 blur-3xl"
        />
      </div>
    </Reveal>
  );
}

function RepoCard({ repo, index }: { repo: Repo; index: number }) {
  return (
    <Reveal key={repo.full_name} delay={(index % 6) * 0.05}>
      <motion.a
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        href={repo.html_url}
        target="_blank"
        rel="noreferrer"
        className="group block h-full rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/40"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            {repo.full_name.split("/")[0]}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star size={12} className="text-saffron" /> {repo.stargazers_count}
          </span>
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold">{repo.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {repo.description ?? "No description."}
        </p>
        <div className="mt-4 flex items-center justify-between">
          {repo.language && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {repo.language}
            </span>
          )}
          <ArrowRight
            size={14}
            className="text-neon transition-transform group-hover:translate-x-1"
          />
        </div>
      </motion.a>
    </Reveal>
  );
}

const SKELETON = Array.from({ length: 6 }).map((_, i) => (
  <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />
));

function RepoGrid() {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["repos"],
    queryFn: async () => {
      const r = await fetch("/api/repos");
      if (!r.ok) throw new Error("repos");
      return r.json() as Promise<{ repos: Repo[] }>;
    },
  });

  const repos = data?.repos ?? [];

  const needle = query.trim().toLowerCase();

  const filtered = needle
    ? repos.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.full_name.toLowerCase().includes(needle) ||
          (r.description ?? "").toLowerCase().includes(needle) ||
          (r.language ?? "").toLowerCase().includes(needle) ||
          (r.topics ?? []).some((t) => t.toLowerCase().includes(needle)),
      )
    : [];

  const byStars = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 12);

  const byDate = [...repos]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);

  return (
    <>
      <div className="mt-16">
        <Reveal>
          <div className="relative max-w-xl">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              placeholder="Search repos, orgs, languages, topics…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {needle ? (
        <section className="mt-10">
          <Reveal>
            <p className="text-sm text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{needle}&rdquo;
            </p>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full text-muted-foreground">No repositories matched.</p>
            ) : (
              filtered.map((r, i) => <RepoCard key={r.full_name} repo={r} index={i} />)
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-20">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">Most popular</h2>
              <p className="mt-2 text-muted-foreground">Live from GitHub — sorted by stars.</p>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading
                ? SKELETON
                : byStars.map((r, i) => <RepoCard key={r.full_name} repo={r} index={i} />)}
            </div>
          </section>

          <section className="mt-20">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">Latest added</h2>
              <p className="mt-2 text-muted-foreground">
                Live from GitHub — newest repositories first.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading
                ? SKELETON
                : byDate.map((r, i) => <RepoCard key={r.full_name} repo={r} index={i} />)}
            </div>
          </section>
        </>
      )}
    </>
  );
}
