import { createFileRoute } from "@tanstack/react-router";

/**
 * llms-full.txt — A comprehensive plain-text dump of the OpenOdia site
 * for consumption by LLMs and AI agents in a single request.
 */

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "OpenOdia — Open source for the Odia language",
    body: [
      "Website: https://openodia.com",
      "Maintainer: Soumendra Kumar Sahoo (https://www.soumendrak.com)",
      "Source code: https://github.com/soumendrak/openodia-hub",
      "License: MIT",
      "",
      "OpenOdia is a growing constellation of tools, libraries, and resources making the Odia language",
      "a first-class citizen in modern AI and software. It spans three pillars:",
      "",
      "1. @openodia YouTube channel — tutorials, talks, and demos in Odia & English",
      "2. OpenOdia PyPI package (openodia) — Python tools for Odia language processing",
      "3. Awesome-Odia-AI — curated directory of 60+ Odia datasets, models, and tools",
      "",
      "Stats: 10+ OSS initiatives, 60+ curated tools, 100+ open contributors, 5+ years building.",
      "Community: 270+ listings, 5,200+ members across 38 countries.",
    ].join("\n"),
  },
  {
    heading: "Pages",
    body: [
      "- / (Home):         https://openodia.com — Hero, three pillars, featured YouTube videos, FAQ",
      "- /tools:           https://openodia.com/tools — Unified directory of Odia open-source repos, datasets, models, libraries, fonts, and tools",
      "- /models:          https://openodia.com/models — Live registry of Odia AI models on Hugging Face",
      "- /datasets:        https://openodia.com/datasets — Live browser of Odia datasets on Hugging Face",
      "- /tutorials:       https://openodia.com/tutorials — YouTube tutorials from Odia AI channels",
      "- /events:          https://openodia.com/events — Community events (conferences, workshops, hackathons)",
      "- /community:       https://openodia.com/community — GitHub Discussions surfaced on-site",
      "- /api:             https://openodia.com/api — Public API reference with interactive playground",
      "- /about:           https://openodia.com/about — About page with bio and links",
    ].join("\n"),
  },
  {
    heading: "Tools directory (/tools)",
    body: [
      "The /tools page is a unified directory merging GitHub repos and the Awesome-Odia-AI list,",
      "grouped by category (Speech & Audio, Datasets, LLMs, etc.) with a 'Code Repositories'",
      "catch-all for repos not in the awesome list. Browse by category or filter by type",
      "(All / Tools / Repos).",
      "",
      "Source orgs for repos:",
      "- odisha-ml (https://github.com/odisha-ml) — Odisha AI/ML community",
      "- OdiagenAI (https://github.com/OdiagenAI) — Odia GenAI working group",
      "- OdiaWikimedia (https://github.com/OdiaWikimedia) — Odia Wikipedia and Wikimedia projects",
      "- ofdn (https://github.com/ofdn) — Open Foundation for Digital Natives",
      "- OdiaNLP (https://github.com/OdiaNLP) — Odia NLP research",
      "",
      "Python package: openodia (https://pypi.org/project/openodia/)",
      "  - Provides transliteration, text normalization, and language detection for Odia",
    ].join("\n"),
  },
  {
    heading: "Tools directory (Awesome-Odia-AI categories)",
    body: [
      "The tools page parses the Awesome-Odia-AI README and categorizes resources. Categories include:",
      "- Large Language Models",
      "- Speech & Audio (STT, TTS, corpora)",
      "- Datasets (text, vision, speech)",
      "- Libraries & APIs",
      "- Developer Tools",
      "- Educational Resources",
      "- Communication & Social",
      "- Research Papers",
      "- See the full list at https://openodia.com/api/awesome",
    ].join("\n"),
  },
  {
    heading: "YouTube channels",
    body: [
      "Tutorials and video content from these channels:",
      "- @openodia (https://www.youtube.com/@openodia) — OpenOdia official channel",
      "- @OdiaGenAI (https://www.youtube.com/@OdiaGenAI) — Odia GenAI content",
      "- @OdiasInML (https://www.youtube.com/@OdiasInML) — Odias in Machine Learning",
      "- @tfugbbsr (https://www.youtube.com/@tfugbbsr) — TFUG Bhubaneswar",
      "",
      "Featured videos from @openodia:",
      "- Introduction to AI and NLP in Odia (Part-1): https://www.youtube.com/watch?v=0ZZhvnGCiBo",
      "- Natural Language Processing in Odia (Part-0): https://www.youtube.com/watch?v=vp7ibQr_Jrs",
      "- ChatGPT explained: https://www.youtube.com/watch?v=dkeBXKjxpc8",
    ].join("\n"),
  },
  {
    heading: "Events & Community",
    body: [
      "Upcoming and past community events from these chapters:",
      "- GDG Bhubaneswar",
      "- GDGoC NIST Berhampur",
      "- GDGoC CVR College of Engineering",
      "- GDGoC IIIT Bhubaneswar",
      "- GDGoC ITER SOA",
      "- GDGoC KIIT",
      "- TFUG Bhubaneswar",
      "- OdiaGenAI",
      "- OdishaAI",
      "",
      "RSS feed available at: https://openodia.com/events-feed",
    ].join("\n"),
  },
  {
    heading: "FAQ (from homepage — common questions about Odia AI)",
    body: [
      "Q: What is OpenOdia?",
      "A: OpenOdia is a hub for Odia language open-source — a growing collection of tools, libraries, and resources making Odia a first-class citizen in modern AI and software. It spans a YouTube channel, a Python package, and the Awesome-Odia-AI directory.",
      "",
      "Q: How can I contribute to Odia AI?",
      "A: Join the odisha-ml GitHub org, submit tools to Awesome-Odia-AI, publish Odia Python packages to PyPI, create tutorial content, or participate in OdishaAI events.",
      "",
      "Q: What Odia language AI tools exist?",
      "A: Over 60 tools including STT, TTS, datasets, fine-tuned LLMs, transliteration libraries, and NLP toolkits. Browse at https://openodia.com/tools.",
      "",
      "Q: Who maintains OpenOdia?",
      "A: Soumendra Kumar Sahoo, an observability engineer at PepsiCo, as part of the OdishaAI community.",
      "",
      "Q: Where can I learn Odia NLP?",
      "A: The @openodia YouTube channel has tutorials in Odia & English. See https://openodia.com/tutorials.",
      "",
      "Q: Is OpenOdia open source?",
      "A: Yes, MIT license. Code at https://github.com/soumendrak/openodia-hub.",
      "",
      "Q: What is the OpenOdia Python package?",
      "A: 'pip install openodia' — provides transliteration, text normalization, and language detection for Odia.",
    ].join("\n"),
  },
  {
    heading: "License",
    body: "All content and code in the OpenOdia project is licensed under the MIT License unless otherwise noted.",
  },
];

export const Route = createFileRoute("/llms-full/txt")({
  server: {
    handlers: {
      GET: () => {
        const separator = "\n" + "=".repeat(72) + "\n";
        const content = SECTIONS.map((s) => `# ${s.heading}\n${separator}\n${s.body}`).join("\n\n");

        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
