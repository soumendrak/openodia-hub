import { Reveal } from "./Reveal";

/**
 * Exported so the FAQPage JSON-LD on the home page is generated from the same
 * array that renders — the two used to be hand-kept copies and had drifted.
 */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is OpenOdia?",
    a: "OpenOdia is a community hub for open-source Odia language work. It brings the ecosystem into one place: tools and libraries, models and datasets, and the people teaching and building with them — from OdiaGenAI, OdiaNLP, OdiaWikimedia, Odisha AI, Odia-Digital and many independent maintainers.",
  },
  {
    q: "Who is behind OpenOdia?",
    a: "The Odia open-source community. The hub was started by Soumendra Kumar Sahoo and is maintained with contributions from across the ecosystem — OdiaGenAI, OdiaNLP, OdiaWikimedia, Odisha AI (odisha-ml), Odia-Digital, and individual maintainers whose projects are listed in the directory.",
  },
  {
    q: "How do I get my project listed?",
    a: "Two routes. Add it to the Awesome-Odia-AI list (github.com/odisha-ml/Awesome-Odia-AI) and it appears in the directory on the next refresh, or open an issue on github.com/soumendrak/openodia-hub. Include a license, a one-line description, and — for datasets and models — the size and task, so the entry arrives citable.",
  },
  {
    q: "What Odia language AI resources exist?",
    a: "Speech recognition and text-to-speech, translation and transliteration, fine-tuned LLMs, embeddings, OCR, spell checkers, fonts, dictionaries, corpora, and language-learning apps. Browse tools at openodia.com/tools, models at /models, and datasets at /datasets — each entry carries its license and a citation.",
  },
  {
    q: "How can I contribute to Odia open source?",
    a: "Add or improve entries in Awesome-Odia-AI, contribute to a listed project, publish Odia-language packages (openodia on PyPI is one example), record tutorials for any of the community channels, or join Odisha AI community events listed at openodia.com/events.",
  },
  {
    q: "Where can I learn Odia NLP?",
    a: "The tutorials page aggregates videos and playlists from the community's channels — OdiaGenAI, OpenOdia, Odias in ML, and TFUG Bhubaneswar — in both Odia and English. See openodia.com/tutorials.",
  },
  {
    q: "Is OpenOdia open source?",
    a: "Yes. The hub itself is MIT-licensed at github.com/soumendrak/openodia-hub. Listed projects carry their own licenses, shown on every card.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold md:text-5xl">
          Frequently asked questions
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Everything you need to know about OpenOdia and the Odia open-source ecosystem.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {FAQS.map((faq, i) => (
          <Reveal key={i} delay={i * 0.03}>
            <details className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/30">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-display text-lg font-semibold leading-tight [&::-webkit-details-marker]:hidden">
                <span>{faq.q}</span>
                <span className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
