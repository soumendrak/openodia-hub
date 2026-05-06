
# OpenOdia.com — Build Plan

A dark, futuristic showcase site for Soumendra Kumar Sahoo's open-source Odia language work, with physics-based motion and a smooth, Framer-style flow.

## Visual Direction

- **Palette**: Near-black background (`oklch(0.12 0.02 270)`), neon cyan + magenta accents, warm saffron highlight (nod to Odia/Jagannath culture). All defined as semantic tokens in `src/styles.css`.
- **Typography**: Display font `Space Grotesk` (oversized, tight tracking) for headlines; `Inter` for body; `JetBrains Mono` for code/PyPI snippets. A subtle Odia script element (ଓ) used as a recurring graphic motif.
- **Background motifs**: Subtle SVG patterns inspired by Pattachitra/Odia temple geometry, low-opacity, parallax-scrolled. Animated gradient mesh + soft noise overlay.
- **Motion language**: Spring physics (Framer Motion), magnetic cursor on CTAs, draggable cards with momentum, scroll-linked reveals, marquee strips, page transitions with shared layout IDs.

## Pages (TanStack Start file routes)

```text
src/routes/
  __root.tsx          shared shell: nav, footer, scroll progress, smooth scroll
  index.tsx           / — Home: hero, highlights for each pillar
  projects.tsx        /projects — OpenOdia PyPI + other OSS projects
  tools.tsx           /tools — Awesome-Odia-AI directory (live)
  about.tsx           /about — Soumendra bio + contact + socials
  api/awesome.ts      server route that fetches & parses the README
  api/og.$page.ts     (optional) dynamic OG image route
```

Each route gets its own `head()` with unique title/description/og tags.

## Page-by-page

### Home (`/`)
- Full-viewport hero: massive headline "Open source for Odia." with a physics-driven reveal (letters spring in, ଓ glyph orbits). Magnetic "Explore" + "YouTube" CTAs.
- Three pillar cards (YouTube / PyPI package / Awesome-Odia-AI) — draggable with spring snap-back, hover tilt.
- Scroll-triggered stats strip (GitHub stars, PyPI downloads, # tools curated) — numbers count up via spring.
- Featured videos rail (3 manual IDs) and a "Latest tools" preview pulled from the same source as `/tools`.
- Marquee of project/tool names at the bottom.

### Projects (`/projects`)
- Hero card for **OpenOdia** PyPI package: install snippet (`pip install openodia`) with copy button, feature bullets (transliteration, NER, datasets, etc.), GitHub + PyPI buttons, animated terminal demo.
- Grid of other repos under Soumendra/odisha-ml — fetched live from GitHub REST API (`/users/soumendrak/repos` + `/orgs/odisha-ml/repos`, filtered/curated). Cards show stars, language, last updated; physics hover.

### Tools (`/tools`) — Awesome-Odia-AI directory
- Live-fetched directory parsed from the Awesome-Odia-AI README.
- Search box + category chips (Datasets, Models, Libraries, Papers, etc. derived from README headings).
- Card grid with category color coding, external-link, GitHub/paper icons; staggered entrance animation.
- "Updated from GitHub" badge with last-fetched timestamp; manual refresh button (revalidates the query).

### About / Contact (`/about`)
- Portrait/avatar with parallax. Short bio for Soumendra.
- Timeline of initiatives (animated vertical line that draws on scroll).
- Contact: GitHub, LinkedIn, X/Twitter, YouTube, email — magnetic icon buttons.
- "Sponsor" CTA linking to GitHub Sponsors.

## Data layer (live GitHub fetch)

Implemented as TanStack server routes / server functions cached with TanStack Query so the site stays fresh without rebuilds.

- `GET /api/awesome` — server route fetches `https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/README.md`, parses sections + links into `{ category, name, url, description }[]`, caches for 1 hour with `Cache-Control: s-maxage=3600`.
- `GET /api/repos` — fetches GitHub repos for `soumendrak` and `odisha-ml`, returns curated list with star counts.
- `GET /api/pypi` — fetches `https://pypi.org/pypi/openodia/json` for version + download stats (uses pypistats endpoint for downloads).
- Client uses `useSuspenseQuery` + route loaders (`ensureQueryData`) so data is SSR'd and cached.
- YouTube videos: a small constant array of video IDs in `src/data/videos.ts` (you'll provide the IDs; we'll embed via `youtube-nocookie.com` lite player).

## Animation stack

- `framer-motion` — springs, layout animations, drag, scroll-linked variants.
- `lenis` — smooth scrolling site-wide (mounted in `__root.tsx`).
- `@react-spring/web` — only if a specific physics interaction (e.g., draggable card pile) needs it; otherwise stick to Framer.
- Reusable primitives: `<MagneticButton>`, `<TiltCard>`, `<SplitText>`, `<DraggableCard>`, `<Marquee>`, `<CountUp>`, `<RevealOnScroll>`.

## SEO & metadata

- Per-route `head()` with unique title + description + og tags.
- JSON-LD `Person` schema on `/about`, `SoftwareSourceCode` on `/projects`.
- `sitemap.xml` + `robots.txt` generated via server routes.
- Canonical tags, viewport, favicon (custom ଓ glyph mark).

## Out of scope (this build)

- No auth, no DB (Lovable Cloud not needed).
- No CMS — content lives in code; tools/repos auto-refresh from GitHub.
- Custom domain wiring (you already own `openodia.com`; connect via Project Settings → Domains after publishing).

## Technical notes

- Stack: TanStack Start v1 + React 19 + Tailwind v4 (already in template).
- New deps: `framer-motion`, `lenis`, `lucide-react` (icons), `marked` (parse README markdown server-side).
- All GitHub/PyPI fetches are server-side (no CORS, cached). No API keys needed for these public endpoints.
- Strict accessibility: prefers-reduced-motion disables physics/marquee; focus-visible rings; semantic landmarks.

## Deliverables order

1. Design tokens + global styles (dark theme, fonts, motifs).
2. Shared shell: nav, footer, smooth scroll, page transitions.
3. Animation primitives library.
4. Home page.
5. Projects page + `/api/repos` + `/api/pypi`.
6. Tools page + `/api/awesome` parser.
7. About page.
8. SEO polish + favicon + sitemap.
