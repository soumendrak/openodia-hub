<p align="center">
  <img src="public/openodia-logo.svg" alt="OpenOdia logo" width="180" height="180">
</p>

<h1 align="center">OpenOdia Hub</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TanStack%20Start-latest-00d4ff?style=flat-square" alt="TanStack Start">
  <img src="https://img.shields.io/badge/React-19-00d4ff?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-4-00d4ff?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-deployed-ff2d95?style=flat-square&logo=cloudflare" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Bun-package%20manager-ff2d95?style=flat-square&logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/license-MIT-00d4ff?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <strong>Open source for the Odia language</strong> — a growing constellation of tools, libraries,<br>
  and resources making Odia a first-class citizen in modern AI and software.
</p>

<p align="center">
  <a href="https://openodia.com">openodia.com</a>
</p>

---

## What is OpenOdia?

OpenOdia is the community hub for Odia language open-source. It was started by
[Soumendra Kumar Sahoo](https://github.com/soumendrak) and brings together work from —
[OdiaGenAI](https://github.com/OdiaGenAI), [OdiaNLP](https://github.com/OdiaNLP),
[OdiaWikimedia](https://github.com/OdiaWikimedia), [Odisha AI](https://github.com/odisha-ml),
[Odia-Digital](https://github.com/Odia-Digital), and many independent maintainers.

It gathers the ecosystem into three places to look:

- **[Tools & libraries](https://openodia.com/tools)** — fonts, keyboards, transliterators, OCR, NLP toolkits and apps, curated from [Awesome-Odia-AI](https://github.com/odisha-ml/Awesome-Odia-AI) and the Odia GitHub organisations
- **[Models & datasets](https://openodia.com/models)** — a cached directory of Odia-tagged Hugging Face resources, with available license, size, and citation metadata
- **[Community & learning](https://openodia.com/tutorials)** — tutorials and talks from the community's channels, plus its meetups and conferences

Individual projects sit _inside_ those pillars — including
[`openodia` (PyPI)](https://pypi.org/project/openodia/), a Python package of Odia text-processing
utilities, and the [@openodia](https://www.youtube.com/@openodia) YouTube channel. Note the name
collision: **OpenOdia** is this hub; **`openodia`** is one package listed in it.

This repository contains the web application, server-side source adapters, public APIs,
and Cloudflare Worker that bring everything together.

## Explore the site

| Page                                                | What you can do                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Home](https://openodia.com)                        | Discover the collection, independent communities, featured videos, and contributors |
| [Tools](https://openodia.com/tools)                 | Search projects; combine source, category, organisation, and license filters        |
| [Models](https://openodia.com/models)               | Find Odia-tagged models by task and license; inspect upstream metadata              |
| [Datasets](https://openodia.com/datasets)           | Filter by task, size, and license; open resource details and available previews     |
| [Playground](https://openodia.com/playground)       | Run Python examples, try Odialang, or transliterate Odia into other Indic scripts   |
| [Tutorials](https://openodia.com/tutorials)         | Search community videos and browse channels and available playlists                 |
| [Events](https://openodia.com/events)               | Search and filter upcoming/live events and the historical timeline                  |
| [Papers](https://openodia.com/papers)               | Explore Odia NLP research by task and year                                          |
| [Treebank](https://openodia.com/treebank)           | Search annotated Odia sentences by word, part of speech, and dependency relation    |
| [Add your project](https://openodia.com/contribute) | Copy a submission template and find contribution routes                             |
| [API](https://openodia.com/api)                     | Explore the public API reference and unified resource catalog                       |
| [About](https://openodia.com/about)                 | Learn about the hub and its contributors                                            |

Use **⌘K / Ctrl+K** for cross-site search and navigation. Papers, Treebank, API,
and contribution links are also in the footer. The language toggle translates the
navigation; page bodies and upstream content are not fully translated. Light/dark
mode and language preferences are saved locally.

## All Features Walkthrough

[![OpenOdia.com Features Walkthrough (in Odia)](https://i.ytimg.com/vi/i1GBstSHzoI/hqdefault.jpg)](https://www.youtube.com/watch?v=i1GBstSHzoI)

[OpenOdia.com Features Walkthrough (in Odia)](https://www.youtube.com/watch?v=i1GBstSHzoI)

Resource cards offer license information and generated APA/BibTeX citations.
Supported GitHub and Hugging Face resources have shareable `/r/<kind>/<owner>/<name>`
detail pages. Check the original resource's license and preferred citation before reuse;
being listed does not certify quality, accuracy, or unrestricted use.

## Documentation

- [Contributor guide](CONTRIBUTING.md): setup, conventions, checks, and adding resources/events.
- [Architecture and data](docs/architecture.md): loaders, caching, storage, APIs, and deployment.
- [Odia video walkthrough](docs/video-walkthrough-or.md): 10–20 minute recording plan, speaking cues, and FocuSee checklist.
- [Coverage work plan](docs/test-coverage-plan.md): historical baseline and remaining coverage work.
- [Design provenance](public/pattachitra/PROVENANCE.md): Pattachitra-inspired artwork and licensing.

---

## What belongs here

**Everything open source in the Odia language.** No AI gatekeeping. If it's Odia, open source, and useful — it belongs.

| Category                    | Examples                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| 🎯 **Language tools**       | Transliterators, spell checkers, grammar tools, Unicode converters, OCR |
| 🖋 **Fonts & typography**   | Open-source Odia fonts, IMEs, keyboard layouts                          |
| 📚 **Datasets**             | Parallel corpora, monolingual texts, speech data, dictionaries          |
| 🧠 **Models (open weight)** | STT, TTS, embedding, LLM fine-tunes for Odia                            |
| 🐍 **Libraries**            | Python/JS/Rust packages for Odia text processing, dates, numerals       |
| 🎮 **Applications**         | Games, apps, utilities built for or in Odia                             |
| 📖 **Educational**          | Language learning tools, interactive tutorials, grammar references      |
| 🔧 **Infrastructure**       | Odia localization tools, CI/CD for Odia projects, evaluation benchmarks |

---

## Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Framework   | [TanStack Start](https://tanstack.com/start)          |
| Routing     | [TanStack Router](https://tanstack.com/router)        |
| Data        | [TanStack Query](https://tanstack.com/query)          |
| UI          | React 19, Tailwind CSS 4, Radix UI, CSS motion        |
| Icons       | Lucide React                                          |
| Deployment  | [Cloudflare Workers](https://workers.cloudflare.com/) |
| Package mgr | [Bun](https://bun.sh)                                 |

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- Node.js 22+

### Install

```bash
git clone https://github.com/soumendrak/openodia-hub.git
cd openodia-hub
bun install
bun run dev
```

The dev server starts at `http://localhost:9090`.

### Available scripts

| Command                                  | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `bun run dev`                            | Start Vite dev server                              |
| `bun run build`                          | Production build                                   |
| `bun run build:dev`                      | Development-mode build                             |
| `bun run preview`                        | Preview production build                           |
| `bun run lint`                           | Run ESLint                                         |
| `bun run format`                         | Format with Prettier                               |
| `bun run test`                           | Run Vitest tests                                   |
| `bun run test:watch`                     | Watch tests                                        |
| `bun run test:coverage`                  | Full coverage report                               |
| `bun run test:coverage:diff -- --staged` | Require 100% coverage of staged executable changes |
| `bun run hooks:install`                  | Activate version-controlled Git hooks              |

---

## How it works

TanStack Start renders directory pages using server loaders and shared source adapters
in `src/lib/sources/`. Public APIs reuse those adapters. TanStack Query supports
client-side data fetching such as command search and paginated events.

- **Directory:** search, combined facets, clearable filters, and incremental display.
  Facet counts account for other active filters; selections within a facet use OR,
  while different facets use AND.
- **Resource details:** upstream descriptions, source links, metadata, citations,
  catalog cross-references, and dataset previews when the upstream viewer supports them.
- **Playground:** Python runs through Pyodide in the browser; Odialang compiles to
  JavaScript. Transliteration converts scripts, not meaning. Python dependencies
  download on first use, with additional packages loaded on demand. Outbound HTTP
  from user code can be restricted by browser CORS. Community model inference is planned.
- **Events:** checked-in community history merges with paginated events backed by D1;
  dates determine status using IST. A Worker cron syncs events every six hours.
  A separate daily GitHub crawler proposes checked-in event updates through PRs.
- **Research:** papers combine OpenAlex and arXiv; treebank search runs server-side
  against UD_Odia-ODTB. These are discovery aids, not exhaustive indexes.

See [architecture and data](docs/architecture.md) for cache durations, source mappings,
API endpoints, and deployment configuration. Counts and upstream availability change;
this README deliberately avoids fixed catalog totals.

---

## Design — Pattachitra

The home page and Tutorials route are a contemporary digital interpretation inspired by
Odisha's **Pattachitra** painting tradition: a palm-leaf ochre ground, a vermilion painted
panel, antique gold detail, and the exact Noto Sans Oriya `ଓ` (U+0B13) at monumental scale.
It is not an artwork made by a traditional Pattachitra artist, and the independent
communities the site links to are run by their own organisers, not by OpenOdia.

| Where                              | What                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `public/pattachitra/PROVENANCE.md` | Asset origins, references, licences, motion contract                               |
| `public/pattachitra/`              | Frame, divider, exact glyph contour, OFL licence                                   |
| `src/styles/pattachitra.css`       | The composition — every rule scoped to `.patta`                                    |
| `src/styles.css`                   | The palette, as tokens the whole site reads                                        |
| `src/components/OdiaGlyph.tsx`     | The exact contour, plus its gold treatment                                         |
| `.lavish/homepage-revamp/`         | The approved mockup and its review history (local only — `.lavish/` is gitignored) |

Decorative motion is transform/opacity only, pauses on a hidden tab, and is removed
entirely under `prefers-reduced-motion`. Verify in a browser with:

```bash
bun run dev &
just check-pattachitra          # widths, loaded art, peacock clearance, reduced motion
```

---

## Deployment

```bash
bun run build
npx wrangler deploy
```

GitHub Actions runs lint, changed-line coverage, and build jobs in parallel. Deployment
on `main` waits for all three. Same-repository PRs get a Worker version preview after
those checks; previews share production KV. See [deployment notes](docs/architecture.md#deployment-and-configuration)
before configuring another Cloudflare account.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and where to help.

Quick checklist before opening a PR:

```bash
bun run lint
bun run build
bun run test
bun run test:coverage:diff -- --staged
```

---

## License

MIT © [Soumendra Kumar Sahoo](https://github.com/soumendrak)
