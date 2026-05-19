# Contributing to OpenOdia

Thanks for wanting to help! Here's how to get started.

## Quick start

```bash
git clone https://github.com/soumendrak/openodia-hub.git
cd openodia-hub
bun install
bun run dev
```

Open `http://localhost:3000` — you're in business.

## Things to know

- **Framework**: TanStack Start with file-based routing. Pages live in `src/routes/`.
- **Styling**: Tailwind CSS 4 + a thin design token layer. The color palette—neon (`#00d4ff`), magenta (`#ff2d95`), saffron (`#f59e0b`)—is used via utility classes like `text-neon`, `from-neon`, `border-neon/40`.
- **Motion**: Use Framer Motion for animations. Wrap things that enter the viewport in `<Reveal>`.
- **Data**: API routes in `src/routes/api/` proxy GitHub, PyPI, and Awesome-Odia-AI. The frontend queries them with TanStack Query.

## Before opening a PR

1. Run `bun run lint` and fix any issues.
2. Run `bun run build` to make sure the production build succeeds.
3. If you added new behavior, consider adding a test.

## Where to help

- **Awesome-Odia-AI directory** (`src/routes/tools.tsx`) — search, filtering, data freshness
- **Project pages** (`src/routes/projects.tsx`) — repo cards, PyPI integration
- **Events & Communities** (`src/data/events/`) — adding past/upcoming events and registering new tech chapters
- **UI polish** — transitions, accessibility, responsive layout
- **SEO** — meta tags, structured data, sitemap

## Adding Events or Communities

The events registry is completely static-driven and modular under `src/data/events/`.

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
