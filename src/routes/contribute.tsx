import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon } from "../components/icons";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { pageHead } from "../lib/seo";

const AWESOME_REPO = "https://github.com/odisha-ml/Awesome-Odia-AI";
const HUB_ISSUES = "https://github.com/soumendrak/openodia-hub/issues/new";

export const Route = createFileRoute("/contribute")({
  head: () =>
    pageHead({
      path: "contribute",
      title: "Add your project · OpenOdia",
      description:
        "Get your Odia open-source project, model, or dataset listed on OpenOdia — the metadata template and the two routes for submitting it.",
      ogDescription: "How to get an Odia project, model, or dataset listed on OpenOdia.",
    }),
  component: ContributePage,
});

/**
 * The template is the mechanism that makes the ecosystem framing real: entries
 * arrive with the metadata the directory renders (license, task, size,
 * citation) instead of needing a cleanup pass afterwards.
 */
const TEMPLATE = `- [Project name](https://github.com/owner/repo) : One sentence on what it does and who it is for (Apache-2.0).

# Fields the directory reads:
#   name         required   what it is called
#   url          required   GitHub repo, Hugging Face model/dataset, or project page
#   description  required   one sentence, plain English, no marketing
#   license      required   SPDX id in parentheses, e.g. (MIT), (Apache-2.0), (CC-BY-4.0)
#   task         required   what it does: ASR, TTS, translation, OCR, NER, corpus, font, keyboard…
#   size         datasets   rows or hours, e.g. 120k sentence pairs / 40 hours audio
#   citation     optional   BibTeX, if the project has a paper`;

const CHECKS: { title: string; body: string }[] = [
  {
    title: "It is about Odia",
    body: "The project targets ଓଡ଼ିଆ specifically, or covers it as a named language alongside others. A general multilingual tool with no Odia support is out of scope.",
  },
  {
    title: "It is open",
    body: "Source, weights, or data are publicly available under a stated license. A license is required — an entry without one is listed as “No license”, which is a warning to researchers, not a badge.",
  },
  {
    title: "It resolves",
    body: "The link points at something live: a GitHub repo, a Hugging Face model or dataset, or a project page that still exists.",
  },
  {
    title: "It says what it is",
    body: "One plain sentence. Descriptions that read as marketing copy get rewritten before listing.",
  },
];

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => setCopied(false),
          );
        }}
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-muted-foreground transition hover:border-neon hover:text-neon"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="max-w-full overflow-x-auto rounded-2xl border border-border bg-surface-2 p-4 pr-20 text-xs leading-relaxed">
        {value}
      </pre>
    </div>
  );
}

function ContributePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Add your project", url: "https://openodia.com/contribute" },
        ])}
      />

      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Contribute</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Add your <span className="text-gradient">project</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          OpenOdia lists the whole Odia open-source ecosystem, not one maintainer's work. If you
          have built something for ଓଡ଼ିଆ — a model, a dataset, a font, a keyboard, a library, an app
          — it belongs here.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-12">
        <h2 className="font-display text-3xl font-semibold">Two routes</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <a
            href={AWESOME_REPO}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-neon/40"
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-neon/10 text-neon">
              <GithubIcon size={18} />
            </div>
            <h3 className="font-display text-lg font-semibold">
              Open a PR on Awesome-Odia-AI{" "}
              <ExternalLink size={14} className="inline transition group-hover:text-neon" />
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The directory reads that list directly. Add a line in the right section using the
              template below and the entry appears here on the next refresh — no second step.
            </p>
          </a>

          <a
            href={HUB_ISSUES}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-neon/40"
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-magenta/10 text-magenta">
              <GithubIcon size={18} />
            </div>
            <h3 className="font-display text-lg font-semibold">
              Open an issue on the hub{" "}
              <ExternalLink size={14} className="inline transition group-hover:text-neon" />
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Prefer not to send a PR, or the entry doesn't fit the list's sections? Paste the
              filled-in template into an issue and it gets added for you.
            </p>
          </a>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Models and datasets published on Hugging Face and tagged with the Odia language code{" "}
          <code className="rounded bg-surface-2 px-1">or</code> are picked up automatically — no
          submission needed. Tag your license and{" "}
          <code className="rounded bg-surface-2 px-1">size_categories</code> and the card fills
          itself in.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <h2 className="font-display text-3xl font-semibold">The template</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          These are the fields the directory actually renders. An entry that arrives complete is
          citable and filterable from day one.
        </p>
        <div className="mt-4">
          <CopyBlock value={TEMPLATE} />
        </div>
      </Reveal>

      <Reveal delay={0.15} className="mt-12">
        <h2 className="font-display text-3xl font-semibold">What gets listed</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {CHECKS.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-display font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
