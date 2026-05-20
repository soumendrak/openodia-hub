import { Reveal } from "./Reveal";

const faqs = [
  {
    q: "What is OpenOdia?",
    a: "OpenOdia is a hub for Odia language open-source — a growing collection of tools, libraries, and resources making Odia a first-class citizen in modern AI and software. It spans a YouTube channel (@openodia), a Python package on PyPI, and the Awesome-Odia-AI directory.",
  },
  {
    q: "How can I contribute to Odia AI?",
    a: "You can contribute by joining the odisha-ml GitHub organization, submitting tools to Awesome-Odia-AI, publishing Odia-language Python packages to PyPI, creating tutorial content for @openodia, or participating in OdishaAI community events.",
  },
  {
    q: "What Odia language AI tools exist?",
    a: "Over 60 tools and resources are listed in the Awesome-Odia-AI directory — including speech recognition (STT), text-to-speech (TTS), datasets, fine-tuned LLMs, transliteration libraries, and NLP toolkits. Browse them at openodia.com/tools.",
  },
  {
    q: "Who maintains OpenOdia?",
    a: "OpenOdia is built and maintained by Soumendra Kumar Sahoo, an observability engineer at PepsiCo. It is part of the broader OdishaAI community initiative uniting Odias in AI/ML globally.",
  },
  {
    q: "Where can I learn Odia NLP?",
    a: "The @openodia YouTube channel features tutorials in both Odia and English covering AI, NLP, and language technology. The tutorials page lists all available playlists and videos organized by channel.",
  },
  {
    q: "Is OpenOdia open source?",
    a: "Yes. All code is open source under the MIT license. The website itself is on GitHub at github.com/soumendrak/openodia-hub and welcomes contributions.",
  },
  {
    q: "What is the OpenOdia Python package?",
    a: "The openodia PyPI package provides practical tools for Odia language processing — transliteration, text normalization, and language detection utilities. Install it with 'pip install openodia'.",
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
          Everything you need to know about OpenOdia and the Odia AI ecosystem.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {faqs.map((faq, i) => (
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
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
