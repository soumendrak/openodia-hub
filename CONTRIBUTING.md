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
- **UI polish** — transitions, accessibility, responsive layout
- **SEO** — meta tags, structured data, sitemap

## Issues

Use the issue templates. Bugs get a reproduction step, features get a problem-statement.

Questions? Open a discussion instead.
