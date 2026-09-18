# Contributing to OpenOdia

Thanks for wanting to help! Here's how to get started.

## Quick start

```bash
git clone https://github.com/soumendrak/openodia-hub.git
cd openodia-hub
bun install
bun run dev
```

Open `http://localhost:9090` — you're in business.

## Things to know

- **Runtime:** Bun and Node.js 22+. `bun install` also installs the repository Git hooks through `prepare`.
- **Framework:** TanStack Start with file-based routes in `src/routes/`. Share upstream loading logic in `src/lib/sources/` between server loaders and API routes.
- **Styling:** Tailwind CSS 4 and tokens in `src/styles.css`. Existing utility names such as `text-neon` now resolve to the current theme palette; do not restore the old cyan/magenta values. Pattachitra composition rules live in `src/styles/pattachitra.css` and are scoped to `.patta`.
- **Motion:** Follow the existing CSS and `Reveal` patterns; Framer Motion is no longer a dependency. Respect reduced motion and hidden-tab behavior.
- **Language:** Navigation strings live in `src/locales/en.ts` and `src/locales/or.ts`; missing translations fall back to English. Full-page translation is not yet implemented.
- **Data:** GitHub, Hugging Face, YouTube, research indexes, and curated lists are upstream sources. Handle failures without presenting unavailable data as an authoritative empty catalog.
- **Reference:** [Architecture and data](docs/architecture.md), [design provenance](public/pattachitra/PROVENANCE.md), and the [public contribution page](https://openodia.com/contribute).

## Before opening a PR

1. Run `bun run lint`, `bun run test`, `bun x tsc --noEmit`, and `bun run build`.
2. Add meaningful tests for changed executable behavior. After staging, run `just coverage-diff` or `bun run test:coverage:diff -- --staged`. The pre-commit hook requires 100% coverage of changed executable lines; that is not a claim of 100% repository-wide coverage.
3. For design changes, start the dev server and run `just check-pattachitra`. Check narrow layouts, keyboard operation, and reduced motion.
4. Update documentation for behavior, routes, sources, or setup changes. For documentation-only edits, check formatting, links, and claims against the implementation.

CI runs lint, changed-line coverage, and build; deployment waits for all three.
The broader coverage backlog is in [docs/test-coverage-plan.md](docs/test-coverage-plan.md).

## Where to help

- **Resources:** improve Awesome-Odia-AI entries, source adapters, licenses, citations, and data freshness.
- **Models and datasets:** publish correct Odia language (`or`) and license metadata on Hugging Face; include dataset size metadata where available. Discovery depends on upstream indexing and cache refreshes.
- **Project submissions:** send a PR to [Awesome-Odia-AI](https://github.com/odisha-ml/Awesome-Odia-AI) or open a hub issue using the template on `/contribute`.
- **Playground:** improve reproducible Python examples, Odialang examples, and transliteration explanations.
- **Research:** improve paper discovery and treebank search.
- **Events and tutorials:** correct source links, community history, and channel metadata in `src/data/`.
- **UI and accessibility:** keyboard navigation, responsive layouts, Odia translations, and readable typography.

## Adding Events or Communities

The Events page combines checked-in records under `src/data/events/` with live-source
records served through `/api/events` and D1. The instructions below add checked-in
history; they do not register a new automated crawler source. For automatic discovery,
review `scripts/crawl-events.mjs`, the source registry under
`.agents/skills/crawl-events/references/`, and `CHAPTERS` in `src/routes/api/events.ts`.
The daily GitHub workflow proposes changes for review; the Worker sync runs every six hours.

Check the organiser's page before adding a record. Keep date, location, and registration
claims grounded in that source; an event being listed does not imply registration is open.
Avoid duplicate URLs, including tracking-parameter variants.

### 1. How to add an Event to an existing Community

1. Open the community's file under `src/data/events/<community-slug>.ts`.
2. Append a new `Event` object to the exported array.
3. Keep properties formatted correctly. Providing `startDate` (and optional `endDate`) in `YYYY-MM-DD` format is highly recommended. The site automatically maps dates to their correct chronological Month & Year sections, and evaluates their status (`upcoming`, `live`, or past) dynamically on the fly based on Indian Standard Time (IST).

_Example Event:_

```typescript
  {
    year: "2026",
    date: "23 May 2026",
    title: "Odia AI Developers Meetup",
    url: "https://example.com/event",
    type: "Talk",
    startDate: "2026-05-23",
    location: "Bhubaneswar, Odisha",
    description: "A community talk on building large language models for local languages.",
  }
```

### 2. How to add a brand new Community

1. Create a new data file `src/data/events/<new-community-slug>.ts` using any existing community file as a template.
2. Define and export your event array.
3. Open `src/data/events/index.ts`:
   - Import your exported array at the top.
   - Add a new entry to the `sources` array pairing your display name with your event array:
     ```typescript
     { community: "Your Community Name", events: yourCommunityEvents }
     ```
4. That's it! The new community and all its events will render dynamically on the Events page with autocomplete filter options.

## Issues

Use the issue templates. Bugs get a reproduction step, features get a problem-statement.

Questions? Open a discussion instead.
