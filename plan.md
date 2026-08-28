# OpenOdia Hub — Improvement Plan

_Compiled 2026-08-28 from: a full Playwright walkthrough of the running site (desktop + mobile,
light + dark, EN + OR), a static code audit, and web research into peer projects
(AI4Bharat, Hugging Face, Masakhane, Universal Dependencies, OLAC, TDIL, Papers with Code)
and directory-UX best practices (NN/g, Baymard, W3C ilreq, WebAIM)._

**What's already good:** the Pyodide playground runs `openodia` end-to-end in the browser;
events timeline + RSS feed, sitemap.xml, llms.txt, and 404 handling all work; dark mode is
clean; the command palette is genuinely useful; the visual design is polished and distinctive.

---

## 0. Repositioning: ecosystem hub, not personal project

Direction from the maintainer: the site should represent **open-source Odia as a whole**, not
the `openodia` package or the @openodia channel. Today the personal properties are structurally
centered — two of the home page's "Three pillars" are the maintainer's own package and channel,
the hero's secondary CTA is "Watch on YouTube", the featured-videos rail is single-channel, the
playground runs only `openodia`, and the FAQ dedicates entries to the package and maintainer.
Masakhane is the model to copy here: a community identity that individual projects sit inside.

Concrete changes:

| # | Change | Where |
|---|--------|-------|
| R1 | **Replace the pillars.** "YouTube channel / PyPI package / Tools directory" → ecosystem pillars, e.g. **Tools & libraries · Models & datasets · Community & learning**. The package and channel become *entries inside* those pillars, styled identically to OdiaGenAI, OdiaWikimedia, imsbg's apps, etc. | `src/routes/index.tsx:175`, `src/routes/about.tsx:47` |
| R2 | **Hero copy & CTAs**: keep "Explore the directory" primary; replace "Watch on YouTube" with an ecosystem CTA ("Add your project" or "Browse models"). Lead the hero stats with ecosystem numbers (127 projects, N models, N datasets — pulled live) instead of channel-adjacent claims. | `src/routes/index.tsx` |
| R3 | **Featured videos → community videos.** The tutorials page already aggregates OdiaGenAI + Odias in ML + OpenOdia; make the home rail draw from the same pool and retitle "From the community". | `src/routes/index.tsx`, `src/data/videos.ts` |
| R4 | **FAQ rewrite**: drop/merge "What is the OpenOdia Python package?"; reframe "Who maintains OpenOdia?" as "Who is behind OpenOdia?" answered with the community + list of member projects; add "How do I get my project listed?". | `src/components/FaqSection.tsx:17,29` |
| R5 | **Playground → "Odia NLP playground".** Keep `openodia` as the first engine but frame it as one of several: add a transliteration tab (IndicXlit/Aksharantar) and, later, inference demos for community models. Copy changes from "Run openodia in your browser" to "Try Odia language tools in your browser". | `src/routes/playground.tsx` |
| R6 | **Disambiguate the name collision**: "OpenOdia" the hub vs `openodia` the PyPI package. Refer to the package as "openodia (PyPI)" everywhere; the hub's identity is the ecosystem. Update README/About framing ("Built and maintained by …" → "Started by …, maintained by the community"). | `README.md`, `src/routes/about.tsx` |
| R7 | **Projects, not repos.** Give ecosystem orgs (OdiaGenAI, Odisha AI, OdiaWikimedia, Odia-Digital…) grouped presence in the directory — an "Organizations" facet or rail — so the hub visibly hosts many actors. The weekly featured rotation already does maintainer-neutral spotlighting; keep it. | `src/routes/tools.tsx` |
| R8 | **Open the contribution path**: "Add your project" page with the structured metadata template (see feature #5) linked from nav/footer — the mechanism that makes ecosystem ownership real rather than rhetorical. | new route + `Nav.tsx`/`Footer.tsx` |

This direction also raises the priority of feature #14 (unified Odia catalog) and #16
(community feedback loops): both are ecosystem moves that no single-maintainer property can
credibly make.

---

## 1. Bugs & defects

### High

| # | Defect | Evidence / location |
|---|--------|---------------------|
| B1 | **Language toggle is a placebo.** `or.ts` contains zero translations, and only ~25 strings are routed through i18n at all. Clicking the toggle flips `<html lang="or">` and the button label, but every visible string stays English — worse than no toggle, because it misdeclares the document language to screen readers and search engines. | `src/locales/or.ts`, `src/lib/i18n.tsx` (verified in browser: `locale=or`, content 100% English) |
| B2 | **No language toggle on mobile at all.** The header collapses to search/theme/hamburger; the hamburger menu contains only nav links. Mobile users — the majority in India — can never switch language. | `src/components/Nav.tsx` (verified at 375px) |
| B3 | **Hydration mismatch on every page load**: server renders `<html>` without the theme class, client adds `className="light"` → React "tree hydrated but attributes didn't match" error on every navigation. Risks theme flash and masks real hydration bugs. | browser console, every route |
| B4 | **Directory pages are empty at SSR.** /tools, /models, /datasets render "All (0)" with no items in the server HTML; all content arrives via client-side fetch. Search engines and no-JS/slow clients see an empty directory — the site's core content is invisible to Google. Move the fetch into route loaders (TanStack Start supports SSR loaders natively) or prerender a snapshot. | `src/routes/tools.tsx`, `models.tsx`, `datasets.tsx` |
| B5 | **Contributors section never loads.** Home and About permanently show "Contributor data is being gathered from GitHub." — the fallback state is the only state (no D1 data locally; verify prod). If prod is also empty, the "100+ Open contributors" stat above it is contradicted on the same screen. | `src/components/ContributorGrid.tsx`, `db/schema.sql` |

### Medium

| # | Defect | Evidence / location |
|---|--------|---------------------|
| B6 | Featured-repo card images 429 from `opengraph.githubassets.com` (rate-limited, no error fallback) — broken hero images on the tools page. Cache the images or fall back to a styled placeholder. | browser network log, `FeaturedGallery` |
| B7 | Command palette `DialogContent` lacks `DialogTitle`/`Description` — Radix logs accessibility errors; screen-reader users get an unlabeled dialog. | `src/components/CommandPalette.tsx` |
| B8 | Curated data quality: "Pe-train Dataset" (typo for Pre-train), "he largest collection…" (dropped T), "code()" artifact text, "No description." shown on a featured card, trailing "language ." spacing, and several AI-generated-sounding descriptions ("meticulously engineered", "highly capable", "sovereign, Bhashini-backed"). One proofread pass over the curated JSON fixes all of these. | /tools cards (visible in UI) |
| B9 | Taxonomy conflation on /tools: datasets and models all carry a "Tool" badge; category chips mix curated categories with raw types. On /models, HF pipeline tags are inconsistently humanized ("Fill mask" vs "sentence-similarity" vs "audio-classification"). | /tools, /models filter rows |
| B10 | Dataset cards on /datasets dump the entire raw HF dataset-card description (hundreds of words, markdown artifacts, "See the full description on the dataset page:" boilerplate) into a card. Truncate at ~2 sentences. | /datasets cards |
| B11 | The keyword marquee on the home page duplicates its content for the infinite-scroll effect; if the duplicate isn't `aria-hidden`, screen readers read the full list twice. | `src/components/Marquee.tsx` |

### Low

| # | Defect | Evidence / location |
|---|--------|---------------------|
| B12 | Footer heart icon has no accessible text — screen readers hear "Built with in Odisha". Add `aria-label`/sr-only "love". | `src/components/Footer.tsx:110` |
| B13 | Models/datasets registries silently cap at "All (200)" with no indication whether that's everything HF has for Odia. | /models, /datasets |
| B14 | Rybbit analytics runs session-replay recording with no privacy notice anywhere on the site. | network log: `rybbit.ekathi.com/api/session-replay` |

### Code-level findings (static audit)

Tooling baseline: `bun run lint` 0 errors / 20 warnings, `bun run test` 60/60 pass,
`bunx tsc --noEmit` clean. The findings below were verified by reading the code.

**High**

| # | Defect | Location |
|---|--------|----------|
| C1 | **`/api/repos` fires ~147 GitHub subrequests per request with no server-side caching** (no Workers Cache API/KV use anywhere; `s-maxage` on Worker responses isn't CDN-honored). Free-plan subrequest caps or GitHub's 60/hr unauthenticated rate limit (shared Cloudflare egress IPs) make every fetch return null — and the handler then returns `{repos: []}` with HTTP 200, so the directory silently renders empty. Likely the root cause of intermittent "All (0)" states. | `src/routes/api/repos.ts:196` |
| C2 | **Event merge clobbers curated data.** `{...existing, ...e}` merges D1 events over curated ones by URL, and D1 rows always carry `location: undefined` / `description: ""` as *present* keys — so hand-enriched venue lines and descriptions are overwritten with nothing. | `src/routes/events.tsx:224`, `events-feed.ts:133`, `src/lib/events-store.ts:103` |
| C3 | **Stored-XSS vector in JSON-LD**: `JSON.stringify(data)` injected via `dangerouslySetInnerHTML` without escaping `</script>`; the data includes remote content (Awesome README descriptions, HF dataset descriptions). A malicious upstream description can inject a script into every visitor's page. Escape `<` as `<`. | `src/lib/jsonld.tsx:9` |

**Medium**

| # | Defect | Location |
|---|--------|----------|
| C4 | Playground permanently errors if you navigate away and back during the Pyodide download (script tag exists but `window.loadPyodide` not yet defined); every remount also re-runs the full Pyodide + micropip init. | `src/routes/playground.tsx:147-160` |
| C5 | CodeEditor is a keyboard trap (Tab/Shift+Tab always `preventDefault()` — WCAG 2.1.2) and ignores `isComposing`, breaking Enter during IME composition — especially bad for Odia typists. | `src/components/CodeEditor.tsx:70-129` |
| C6 | Events timeline sidebar (Upcoming/year chips) is `<div onClick>` — no role, tabIndex, or key handlers; unusable by keyboard/screen readers. | `src/routes/events.tsx:617-703` |
| C7 | CommandPalette keys Awesome entries by URL, but the list reuses URLs across entries (tools.tsx itself documents this and keys by index) → duplicate React keys, dropped rows. | `src/components/CommandPalette.tsx:183` |
| C8 | `og:image`/`twitter:image` point to an SVG — Facebook, X, and LinkedIn don't render SVG previews, so shares of openodia.com get no image. | `src/routes/__root.tsx:87-92` |
| C9 | `/api/events` has two implementations: `server.ts:176` intercepts the path before the router, so the entire route-file handler is dead code that diverges (it never reads D1). Future edits there will silently do nothing. | `src/server.ts:176`, `src/routes/api/events.ts:135` |
| C10 | D1 event archive decays: each sync deactivates events missing from the current Bevy page (which only lists a window), and reads drop deactivated rows after 30 days — old events permanently vanish; one failed chapter fetch mass-deactivates that chapter. | `src/lib/events-store.ts:88-96` |
| C11 | sync-contributors merges repos by short name, not `full_name` — the curated list has same-name repos under different owners (`GnsP/odia-keyboard` vs `Odia-Digital/odia-keyboard`), so commits get folded into the wrong repo row. | `scripts/sync-contributors.ts:255` |
| C12 | CORS preflight fails: handlers advertise `Allow-Methods: GET, OPTIONS` but no OPTIONS route exists; the server intercept also runs the full D1/scrape work for any method. | all `src/routes/api/*`, `src/server.ts:176` |

**Low**

| # | Defect | Location |
|---|--------|----------|
| C13 | Awesome description cleaner deletes markdown link *text* instead of keeping it (`"$1"` missing) — the visible "code()" artifacts and missing words on /tools cards. | `src/routes/api/awesome.ts:78` |
| C14 | XML entity decode order double-decodes (`&amp;` replaced first) in the videos feed. | `src/routes/api/videos.ts:33-39` |
| C15 | "All categories" chip doesn't reset pagination like every other chip. | `src/routes/tools.tsx:314` |
| C16 | "Showing X of Y past events" counts upcoming events in Y. | `src/routes/events.tsx:795` |
| C17 | Dead code: `src/lib/cors.ts` and `src/data/contributors.ts` imported nowhere; unused `upcomingEvents`/`pastEvents` and an impossible `status === "past"` comparison in events.tsx. | various |
| C18 | OpenAPI spec on /api documents `cursor`/`limit` pagination that `/api/repos` ignores. | `src/server.ts:303` |
| C19 | Multi-day Bevy events get `endDate = startDate`, flipping to "past" a day early. | `src/routes/api/events.ts:125` |
| C20 | llms-full.txt lists three featured videos that don't match `src/data/videos.ts`, omits /playground, and llms.txt cites llmstxt.com (standard lives at llmstxt.org). | `src/routes/llms-full.txt.ts:84`, `llms.txt.ts:56` |
| C21 | crawl-events.mjs: UA advertises wrong domain (openodia.org), unescaped backslashes can emit invalid TS literals, year-spanning ranges ("30 Dec 2024 – 2 Jan 2025") apply the start year to both ends. | `scripts/crawl-events.mjs:187,420` |
| C22 | `<Link><MagneticButton>` renders a `<button>` inside an `<a>` (invalid HTML, double tab stop); mobile menu button lacks `aria-expanded`. | `src/routes/index.tsx:152`, `Nav.tsx:115` |
| C23 | `GITHUB_TOKEN` read at module scope with no wrangler binding defined — if absent, all GitHub calls run unauthenticated (compounds C1). D1 `NOT IN` binding will exceed the 100-parameter limit if chapters ever list >100 events. | `src/routes/api/repos.ts:158`, `events-store.ts:88` |

---

## 2. Features for academicians, students & research assistants

Ranked by leverage-per-effort for the stated audience. Peer-hub evidence: every serious
research hub (HF, UD, AI4Bharat) has citations and licenses as table stakes; the 2026
"dataset visibility asymmetry" literature identifies catalog fragmentation as the #1
low-resource-NLP pain point — and Odia alone has 3+ overlapping catalogs today.

### Quick wins (small effort, high academic value)

1. **BibTeX / APA citation button on every resource card.** The single most-requested academic
   affordance; HF auto-renders it from card YAML, UD and AI4Bharat list it per resource.
   Curated entries get a hand-checked citation; HF-sourced entries can pull the `citation`
   field from the card via API.
2. **SPDX license badge + license filter** on tools/models/datasets. Researchers must know
   "can I use this in a paper / product?" before anything else. Awesome-Odia-AI already has
   partial license tags to seed from.
3. **Dataset statistics line** on each dataset card: size, token/sentence count, splits,
   domain — normalized across entries (HF API exposes most of this).
4. **"Last updated / last verified" freshness flag** + a CI link-checker over the curated list.
   Dead links are the known trust-killer of awesome-lists.
5. **Structured contribution template** (PR form requiring license, citation, size, task) so
   new entries arrive with metadata instead of needing cleanup later.
6. **Version linking**: OdiEnCorp 1.0/2.0 and similar should appear as one resource with
   versions, not unrelated entries.

### Medium effort

7. **Odia NLP benchmark/leaderboard page** — task × dataset × metric table seeded from
   IndicGLUE/IndicXTREME Odia subsets and WAT results. Papers with Code is dead (July 2025);
   there is *no* current home for Odia leaderboards. This is the highest-differentiation
   feature on the list.
8. **Research-paper index for Odia NLP** — pull ACL Anthology + arXiv by query, tag by task.
   No such index exists anywhere.
9. **Dataset preview** — first N rows/sentences inline (HF datasets-server API provides this
   for free for HF-hosted sets). "Inspect before download" is the most-loved HF feature.
10. **Catalog JSON API** (`/api/resources`) — the machine-readable catalog for notebooks and
    downstream tools; the OLAC federated-metadata model shows aggregators win by being
    machine-readable. (The site already has `/api/awesome` + `/api/repos` — formalize and
    document them on the /api page.)
11. **Dictionary / IndoWordNet lookup widget** — IndoWordNet covers Odia; a lookup box is a
    daily-use student tool.
12. **Transliteration & Odia typing tool** in the playground (Aksharantar/IndicXlit exist;
    mostly integration). Students without Odia keyboards are a real audience.
13. **Teaching-materials section** — syllabi, slides, problem sets tagged by level. No Indic
    hub offers this; directly serves the academic audience.

### Large / strategic

14. **Become the unified Odia catalog** — dedupe Awesome-Odia-AI + Odia-NLP-Resource-Catalog +
    indicnlp_catalog + HF into one canonical entry per resource with cross-references. This
    solves the fragmentation problem the research literature names, rather than adding a 4th
    partial catalog to it.
15. **Corpus search / concordance (KWIC) tool** over one flagship Odia corpus, plus a browser
    for the UD_Odia-ODTB treebank (which has no public search UI anywhere).
16. **Native-speaker feedback loop on model outputs** (Masakhane Web pattern) — turns the
    community pillar into training-signal generation.

---

## 3. UX improvements

### Highest impact

1. **Make the Odia experience real** (ties to B1/B2): translate the ~40 UI strings, put the
   toggle on mobile, label it "ଓଡ଼ିଆ / English" in native script (i18n convention), persist
   choice (already done via localStorage). A hub whose mission is "Odia first-class" showing
   0% Odia UI undermines its own pitch.
2. **SSR the directory content** (ties to B4) — also the single biggest SEO and
   slow-connection win. Baymard/NN/g data: users on slow networks abandon empty-looking pages.
3. **Real faceted filtering** on tools/models/datasets: task + license + language-coverage +
   modality facets with live result counts, active-filter chips with one-click removal,
   checkboxes for multi-select. NN/g: faceted navigation completes catalog tasks 25–50%
   faster than search alone. On mobile, use a filter drawer with an explicit "Show N results"
   button (Baymard).
4. **Odia typography mechanics** (W3C ilreq): use Noto Sans Oriya with `font-display: swap`;
   never letter-space Odia text (severs the script's joining strokes); give Odia body text
   more line-height than Latin (matras need vertical clearance); never glyph-subset Indic
   fonts aggressively or conjuncts break.
5. **Per-resource detail URLs + "copy link" affordance.** Academics cite things; today every
   card links straight off-site and nothing on the hub is permalinkable. This also unlocks
   citation export (feature #1) and social previews.

### Solid improvements

6. **Empty/zero-result states as recovery moments**: "No tools match 'OCR' + Apache-2.0 —
   clear license filter?" instead of a blank grid; announce via aria-live.
7. **Metadata badges in list view** (license, stars/downloads, last-updated) so researchers
   scan without opening every card — the Papers-with-Code density model.
8. **Truncate dataset-card dumps** (B10) to 2 sentences + "more".
9. **PWA/offline shell + adaptive loading.** Twitter Lite-style offline caching cut data use
   ~70% in comparable markets; Google's Next Billion Users guidance treats offline-first as
   baseline for Indian mobile audiences. At minimum: cache the curated catalog so /tools
   works offline.
10. **Contrast audit** in both themes, checking English and Odia text separately (Odia glyphs
    render lighter at the same weight). WebAIM: contrast is the #1 WCAG failure on 83.6% of
    homepages.
11. **Command-palette discoverability**: put a visible "⌘K" hint inside the search *input* on
    directory pages too (the header badge exists; the pattern's known failure is that nobody
    finds it).
12. **Fix dialog a11y** (B7) and marquee double-read (B11).
13. **Honest stats**: "100+ contributors" (home) should come from the same source as the
    contributor grid so they can't contradict each other.
14. **Leaderboard opt-out**: if the contributor leaderboard ranks people, publish the scoring
    rule and allow opt-out (OSS-gamification research flags forced ranking as a demotivator).

### Reference patterns worth copying

- **Hugging Face**: dataset viewer, citation block, license/task/language tags as facets.
- **Papers with Code (archived)**: `<task, dataset, metric>` leaderboard tables; dense list-view metadata.
- **USWDS "two languages" pattern**: for exactly two languages, a single header toggle labeled in the target language — no dropdown.
- **npm registry**: transparent keyword-match ranking, stale-entry demotion — a defensible alternative to ad-hoc curation ordering.
- **Masakhane**: community-run hub with live models + native-speaker feedback loops — the closest structural analog to OpenOdia.

---

## 4. Suggested sequencing

**Every phase ends with the validation gate below. Findings from the gate are fixed inside
that same phase — a phase is not done until the gate passes.**

### Validation gate (run after every phase)

| Step | Command / action | Pass condition |
|------|------------------|----------------|
| V1 | `bunx tsc --noEmit` | 0 errors |
| V2 | `bun run lint` | 0 errors (warnings tracked, not blocking) |
| V3 | `bun run test` | all pass; new logic has a test |
| V4 | `bun run build` | succeeds |
| V5 | Playwright walkthrough of every route the phase touched, at **375px and 1280px** | page renders; **0 console errors/warnings** other than ones the phase deliberately introduced |
| V6 | Playwright check of each fix's observable behaviour (not just "the code changed") | the specific defect no longer reproduces |
| V7 | Re-run V1–V4 after fixing anything V5/V6 found | clean |

Notes that apply to every gate run:

- **`caches.default` is a no-op in local dev** (always `MISS`). Anything relying on the
  Workers Cache API needs a second layer that works locally, or it is untested until deploy.
- **Content lazily mounts on scroll** (Lenis + `Reveal`), so a DOM query before scrolling
  returns an empty grid. Scroll first, then assert.
- **`/api/repos` needs `GITHUB_TOKEN`** in dev (`GITHUB_TOKEN="$(gh auth token)" bun run dev`);
  without it GitHub's 60/hr unauthenticated limit is exhausted within one page load.

---

1. **Week 1 — correctness & credibility fixes:** C1 (cache `/api/repos` in KV/Cache API +
   surface errors instead of empty-200), C2 (merge without clobbering curated fields),
   C3 (escape JSON-LD), B1–B3 (hide or implement the Odia toggle; fix hydration), B6–B8,
   B12, C13 (proofread pass, link-text fix, image fallback, dialog title, footer aria).
   → **Status: done, gate passed — see §5.**
2. **Weeks 2–3 — repositioning + findability:** the copy-level ecosystem reframe (R1–R4, R6 —
   mostly content edits in index/about/FAQ), SSR loaders for the three directories (B4),
   faceted filters + license badges + citation buttons (features 1–3, UX 3), C8 (PNG
   og:image — shares currently render with no preview).
   → **Status: done, gate passed — see §5.**
3. **Month 2 — academic depth + ecosystem structure:** per-resource pages with permalinks,
   dataset previews, freshness checker, documented catalog API, organizations facet +
   "Add your project" flow (R7–R8), multi-tool playground (R5).
   → **Status: done, gate passed — see §5.**
4. **Quarter — differentiation:** Odia benchmark/leaderboard page, paper index, unified
   catalog dedup, corpus/treebank search, community feedback loops.
   → **Status: done, gate passed — see §5.**

---

## 5. Phase log

### Phase 1 — correctness & credibility · **done** · gate passed

**Shipped**

| # | Fix |
|---|-----|
| C1 | `/api/repos` cached in two layers — `caches.default` (cross-isolate, prod only) plus an in-isolate memo, both 30 min, with an `X-Cache: EDGE\|MEMO\|MISS` marker. Zero resolved repos now returns **503 + `error`** instead of a 200 empty list, and /tools renders a `role="status"` notice rather than silently dropping every repo. |
| C2 | `mergeNonEmpty()` (`src/lib/utils.ts`) skips `undefined`/`null`/`""` on merge; wired into `events.tsx` + `events-feed.ts`. Curated venue/description survive the D1 merge. |
| C3 | `serializeJsonLd()` escapes `<` → `\u003c`; `test/jsonld.test.ts` covers breakout + round-trip. |
| B1 | `or.ts` filled for all 12 i18n-routed keys; nav chrome actually flips to Odia. |
| B2 | Locale toggle visible at every width, labeled in the *target* language (`ଓଡ଼ିଆ` / `English`, USWDS pattern), with `lang` on the label. |
| B3 | `suppressHydrationWarning` on `<html>` — the pre-hydration bootstrap script owns `class`/`lang` by design. |
| B6 | `onError` hides the decorative OG backdrop; card carries its own `bg-surface` so a failed image leaves no hole. |
| B7 | `sr-only` `DialogTitle` + `DialogDescription` in `CommandDialog`. |
| B8 | Removed the `"No description."` filler (the only string we own). |
| B12 | Footer heart `aria-hidden` + `sr-only` "love". |
| C13 | Empty link targets (`[code]()`) now stripped too — the source of the `code()` artifact. |

**Found by the gate, fixed in-phase**

| # | Found by | Fix |
|---|----------|-----|
| C7 | V5 — 9 console errors on opening the command palette | Awesome entries keyed by index + URL, matching `tools.tsx`. Was silently dropping rows. |
| — | V6 — /api/repos still 8s and `X-Cache: MISS` on every request | `caches.default` is a no-op in local dev; added the in-isolate memo layer. Cold 8.1s → cached 6ms. |
| — | V6 — /tools showed "Repos (0)" with no explanation on 503 | Added the `role="status"` rate-limit notice; C1's error was surfaced by the API but swallowed by the UI. |
| C17 (part) | V1 — `tsc` was **not** clean at baseline, contrary to §1's tooling note | Fixed the impossible `status === "past"` compare and a `source` widened to `string` by a trailing `.sort()`. |

**Corrections to the plan itself**

- **C13's prescribed fix is wrong for the real data.** Awesome-Odia-AI ends entries with
  `[[paper](url)][[code](url)]` badge clusters; adding `"$1"` glues label text into prose
  (`"…language datasetcode"`, and link-only entries become `"paperwebcode"`). The actual
  `code()` artifact comes from empty targets, which `[^)]+` didn't match. Kept deletion,
  widened to `[^)]*`. Verified against the live README: `()` artifacts 1 → 0, no prose damage.
- **B8's typos are upstream, not ours.** "Pe-train Dataset", "he largest collection",
  "sovereign, Bhashini-backed", "meticulously engineered" all live in
  `odisha-ml/Awesome-Odia-AI/README.md`. Fixing them needs a PR there — there is no local
  "curated JSON" to proofread.
- **B1 is only partly closed.** Odia now covers the nav chrome (12 keys); page bodies are
  still English, so `lang="or"` remains over-declared until UX §3.1 routes the rest.
- **§1's tooling baseline was wrong**: `tsc` had 2 pre-existing errors, and the test count
  was 60, not the 65 now passing.

**Gate results**

`tsc` 0 errors · `lint` 0 errors / 21 warnings · `test` 65/65 · `build` ok ·
Playwright at 375px + 1280px on `/`, `/tools`, `/events`: 0 console errors
(the `/api/repos` 503 seen without a `GITHUB_TOKEN` is C1's intended behaviour).

Behaviours confirmed in-browser, not just in code: locale toggle flips nav both directions and
persists (`localStorage.locale`); toggle visible and labeled at 375px; dialog exposes
`aria-labelledby`/`aria-describedby`; forced image failure sets `display:none` and the card
stays readable; curated event venues survive the merge; `X-Cache` goes `MISS` → `MEMO`
(8.1s → 6ms).

**Deferred, as listed:** B4 (SSR loaders), B5, B9–B11, B13–B14, C4–C6, C8–C12, C14–C23.

---

### Phase 2 — repositioning + findability · **done** · gate passed

**Shipped**

| # | Fix |
|---|-----|
| B4 | **The three directories now SSR.** Fetching moved out of the route files into `src/lib/sources/{repos,awesome,huggingface}.ts`, read through one two-layer cache (`lib/sources/cache.ts`) and called from TanStack `createServerFn` loaders. `/tools`, `/models`, `/datasets` each ship 30 rendered cards in the server HTML; they previously rendered "All (0)". The `/api/*` handlers became thin wrappers over the same functions, so there is one code path instead of two. |
| R1 | Pillars replaced with ecosystem pillars — **Tools & libraries · Models & datasets · Community & learning** — on both the home page and About. The package and channel are entries inside them. |
| R2 | Hero secondary CTA is now "Browse models & datasets" (was "Watch on YouTube"); stats are live ecosystem counts pulled from the same sources the directories render, each tile linking to its page. |
| R3 | Home rail retitled "From the community" and drawn from all four community channels, with the static list as fallback. |
| R4 | FAQ rewritten: the package entry is gone, "Who maintains OpenOdia?" became "Who is behind OpenOdia?" answered with the community and its member orgs, and "How do I get my project listed?" was added. `FAQS` is now exported and the FAQPage JSON-LD is generated from it — the two were hand-kept copies that had already drifted. |
| R6 | README and About reframed: "Started by … maintained by the community", the name collision is stated outright ("**OpenOdia** is this hub; **`openodia`** is one package listed in it"), and the Organization JSON-LD `sameAs` now lists the ecosystem orgs rather than one channel. |
| Feature 1 | **Citations on every card.** A native `<details>` per card yields BibTeX + APA with copy buttons. `lib/citation.ts` emits `@misc` from catalog facts only — name, owner, URL, year — and says so in the UI; it never invents a title, venue, or author list. |
| Feature 2 | **SPDX license badge + license facet** on all three directories. `lib/license.ts` reconciles GitHub `spdx_id`, HF `license:` tags, and Awesome-Odia-AI's inline prose ("… (Apache-2.0).") onto one canonical id, and permissive vs. restricted are visually distinct. Unrecognised strings render "No license" rather than a guess. |
| Feature 3 | **Dataset statistics** — row-count bucket, modality chips, license — from HF's `size_categories` / `modality` tags, no extra round trip. Size is also a facet, sorted small → large. |
| UX 3 | **Real faceted filtering**: multi-select facets with live counts, removable active-filter chips, "Clear all", an `aria-live` result count, and a zero-result state that names the exact combination that failed and offers the way out. |
| C8 | `og:image` is now a PNG (`scripts/build-og-image.mjs` renders the SVG at 1200×630) with `og:image:type` and alt text. SVG previews don't render on Facebook, X, or LinkedIn. |
| B10 | Pulled forward — dataset-card dumps are summarised to two sentences (`summarize`), since the stats line is unreadable underneath a 500-word card. |
| C22 (part) | `MagneticButton` renders a plain span when it has no href and no handler, so `<Link><MagneticButton>` no longer nests a `<button>` inside an `<a>`. |

**Found by the gate, fixed in-phase**

| # | Found by | Fix |
|---|----------|-----|
| B13 | V6 — the new hero stat read exactly "200", because the HF fetch was capped at one page | Followed HF's `Link: rel="next"` pagination. Models 200 → 800, datasets 200 → 457. Where the page cap still bites, the count renders as "800+" and the registry says so in words — B13's complaint was the *silent* cap. |
| — | V6 — the "Odia models" stat tile appeared and disappeared between loads | Sequential HF paging (~6s cold) was overrunning the home page's 3s deadline. Capped pages to 8, raised the deadline to 6s, and warmed all four caches from the existing daily cron. Cold home 7.3s with all four tiles, warm 20ms. |
| — | V6 — `fetchSingleRepo … AbortError` in the dev log | 150 simultaneous GitHub fetches saturated the socket pool and the tail aborted on its own timeout. Added `mapWithConcurrency` (12 in flight). |
| — | V6 — dataset size facet ordered `100B<n<1T`, `n>1T`, `n<1K`, `1K<n<10K` | `sizeRank` didn't know the `T` suffix or the open-ended `n>1T` bucket. Extracted to `lib/dataset-size.ts` with a test; now sorts `n<1K` → `n>1T`. |
| — | V5 at 375px — page overflowed to 409px once a citation was opened | Grid items default to `min-width:auto`, so the BibTeX block set the card's minimum width. Added `min-w-0` to the card in all three grids and `max-w-full break-all` to the `<pre>`. |

**Gate results**

`tsc` 0 errors · `lint` 0 errors / 16 warnings · `test` 82/82 · `build` ok ·
Playwright at 375px and 1280px on `/`, `/tools`, `/models`, `/datasets`: 0 console errors,
0 horizontal overflow (checked with citations open).

Confirmed in-browser: 30 cards + facets + license badges + citations present in the **server**
HTML for all three directories; license facet narrows 457 → 42 datasets and the active chip
removes it; zero-result state reads `No datasets match "zzzznotathing" + Apache-2.0.` and its
Clear button restores 457; BibTeX/APA render from catalog facts; size facet sorts correctly;
home shows the ecosystem pillars, live tiles (174 / 800+ / 457 / 4), "From the community" with
OdiaGenAI videos, 7 FAQs, no "Watch on YouTube", and no `<button>` inside an `<a>`.

**Notes carried forward**

- `/models` lists 800 of a larger Odia-tagged set. The cap is a latency budget (HF pages are
  sequential and the home page waits on them), and it is stated in the UI rather than hidden.
- The mobile filter *drawer* from UX 3 (Baymard's "Show N results" pattern) was not built —
  the facet chips wrap and work at 375px. Add it if the facet list grows.

---

### Phase 3 — academic depth + ecosystem structure · **done** · gate passed

**Shipped**

| # | Fix |
|---|-----|
| UX 5 | **Per-resource permalinks.** `/r/{gh\|model\|dataset}/{owner}/{name}` — SSR'd, canonical-tagged, with `Dataset` / `SoftwareSourceCode` JSON-LD, license, freshness dates, tags, BibTeX/APA, and a "Copy link" button. Identity is derived from the URL (`lib/resource-id.ts`), so a curated Awesome row and the repo it points at resolve to the *same* permalink instead of being two unrelated cards. Directory cards now link to the permalink; entries that resolve to nothing (arXiv, project homepages) still link straight out. |
| Feature 9 | **Dataset preview.** First 5 rows inline from the Hugging Face dataset-viewer API. For a multi-language dataset it picks the Odia config — `wikimedia/wikipedia` opens on `20231101.or`, not the first of 300+ configs. When the viewer has no preview (gated, script-based) the page passes the upstream reason through rather than showing an empty box. |
| Feature 4 | **Freshness.** Detail pages show "Last updated … · published …" from GitHub `updated_at` / HF `lastModified`. `scripts/check-links.mjs` link-checks every URL in the curated list, weekly in CI (`.github/workflows/check-links.yml`). First run found **9 dead links** in Awesome-Odia-AI; gated URLs (HTTP 401/403) are reported separately rather than counted as dead. |
| Feature 10 | **Documented catalog API.** `/api/resources` serves the unified catalog — one deduplicated record per resource across all four sources, keyed by permalink, keeping the curated description and the live metrics. 1,411 records, with Awesome rows merged into their GitHub/HF counterparts (`sources: ["awesome-odia-ai", "huggingface"]`). Filters: `kind`, `license`, `author`, `q`, `limit`, `offset`. Documented in the OpenAPI spec and in llms.txt. |
| R7 | **Organizations facet** on /tools, alongside Source / Category / License — shantipriyap, imsbg, OdiaNLP, odisha-ml, OdiaGenAI, OdiaWikimedia, and the rest, with counts. |
| R8 | **"Add your project"** page at `/contribute`, linked from nav and footer: the two submission routes, the structured metadata template (copy button), and what gets listed. |
| R5 | **Playground reframed** to "Try Odia language tools in your browser." An Engines strip names `openodia (PyPI)` as loaded and marks transliteration and community-model inference as not-yet/planned rather than implying them. Three new samples cover the real toolset — clean/normalise/segment, syllables & numerals, corpus stats. |
| C18 | OpenAPI spec no longer documents `cursor`/`limit` parameters that `/api/repos` and `/api/awesome` ignore; 503 responses are documented. |
| C20 (part) | llms.txt now lists /playground, /contribute and the permalink pattern, cites llmstxt.**org**, and names the ecosystem orgs. |

**Found by the gate, fixed in-phase**

| # | Found by | Fix |
|---|----------|-----|
| — | V6 — the Organisation facet listed `arxiv.org (9)` as an organisation | The facet was reading the citation-attribution field, which falls back to the host for a bare link. Split it: `org` is set only when the URL resolves to a GitHub/HF account. |
| B3 (second case) | V5 — a hydration mismatch on /playground: `tabindex="0"` on the editor's `<pre>` | Prism auto-highlights every `<pre><code class="language-*">` once the document is ready, and `highlightElement` adds `tabindex` — mutating the DOM under React. We only use the string API, so `Prism.manual = true`. The Phase 1 `<html>` fix did not cover this. |
| — | V6 — the "Corpus stats" playground sample threw `TypeError: 'int' object is not callable` | `FreqDist.total_count` and `.ttr` are properties, not methods. Caught only by *running* the sample in the browser; reading the signatures was not enough. All three new samples now execute and produce correct Odia output. |
| — | V6 — dataset descriptions read "built from the dumps ( with one subset…" | URL stripping consumed the closing paren (`\S+` matched it), leaving a dangling "(". Bounded the URL match and cleaned up the empty brackets. |

**Gate results**

`tsc` 0 errors · `lint` 0 errors / 16 warnings · `test` 91/91 · `build` ok ·
Playwright at 375px and 1280px: 0 console errors on `/`, `/tools`, `/contribute`, `/playground`,
and the three permalink kinds; 0 horizontal overflow (the preview table scrolls inside its own
box, as intended).

Confirmed in-browser: permalinks SSR with correct `<title>`, canonical, and schema type; the
Wikipedia dataset preview resolves to the Odia config; "Copy link" flips to "Link copied";
freshness reads "Last updated 12 Nov 2024 · published 10 May 2020"; the Organisation facet
narrows to 16 shantipriyap projects; `/api/resources` returns 1,411 deduplicated records;
`/contribute` is reachable from nav and footer; and all three new playground samples run —
`ଭୁବନେଶ୍ୱର → ['ଭୁ','ବ','ନେ','ଶ୍','ୱ','ର']`, `250000 → ଦୁଇ ଲକ୍ଷ ପଚାଶ ହଜାର`.

**Notes carried forward**

- **R5's transliteration tab is not built.** The AI4Bharat xlit API (`xlit-api.ai4bharat.org`)
  does not resolve, `openodia` has no transliteration function, and a hand-rolled Roman→Odia
  mapper would ship poor output under the hub's name. The playground says "not yet" rather than
  implying it exists. Wire it up when a reachable endpoint or a package function exists.
- The link checker's first run flags 9 dead URLs upstream in Awesome-Odia-AI. Fixing those is a
  PR to that repo, not to this one.

---

### Phase 4 — differentiation · **done** · gate passed

**Shipped**

| # | Fix |
|---|-----|
| Feature 7 | **`/leaderboard` — Odia benchmark results.** One table per `<task, dataset, metric>` (the Papers-with-Code shape), sorted the right way per metric (WER/CER ascending, accuracy descending), one best score per model, each linking to its permalink. **40 results across 10 benchmarks**, read from the `model-index` block of the 300 most-downloaded Odia-tagged model cards. A "How to read this" panel sits *above* the numbers and states that every score is self-reported, that HF-verified scores carry a badge, that scores compare only within one table, and that paper results are deliberately absent. |
| Feature 8 | **`/papers` — research index.** 180 deduplicated papers from OpenAlex + arXiv, filterable by task and year. Relevance rule is stated on the page: title/abstract must name Odia or Oriya **and** the work must be classified under NLP — without the second condition an "Odia" search returns papers on Odishan cuisine and poetry. Task labels are keyword matches and say so. |
| Feature 14 | **Unified catalog is real.** Added Odia-NLP-Resource-Catalog and indicnlp_catalog (filtered to its Odia rows) as sources. **1,460 records, 62 of them cross-listed** — `nlp-for-odia` is one record carrying `["awesome-odia-ai", "odia-nlp-catalog", "github"]` instead of three cards. Permalink pages show "Listed in …" with links to each catalog. This is the fragmentation fix the plan asked for, rather than a fourth partial list. |
| Feature 15 | **`/treebank` — concordance search over UD_Odia-ODTB.** 456 sentences / 5,818 tokens parsed from CoNLL-U server-side (the 700 KB corpus never reaches the browser — only matches do). Search by word form, transliteration, or morphological feature; narrow by UPOS and dependency relation; matches highlighted in context with the English gloss and a full token analysis table. The query lives in the URL, so a result is linkable. The treebank had no public search UI anywhere. |
| Feature 16 | **Not built, by decision** — see below. |

**Found by the gate, fixed in-phase**

| # | Found by | Fix |
|---|----------|-----|
| — | V6 — the Odia-NLP-Resource-Catalog parsed to **zero** entries | It writes links as HTML anchors, and its bullets are `*`. Extending the parser exposed a bigger pre-existing bug: **Awesome-Odia-AI uses `*` for 70 of its 170 rows, and the parser only accepted `-`** — 41% of the curated list had never been shown. Curated entries went **72 → 142**, and the home page's project count 174 → 244. |
| — | V5 at 1024px — the header rendered 1156px of tabs inside a 975px box | Ten nav tabs never fit: the header is capped at `max-w-6xl` (≈1118px inner), so the row would overflow at *every* width and was simply being clipped. Desktop row now starts at `xl` and "Add project" is `menuOnly` (still in the menu, footer, and ⌘K). Nine tabs, fits with headroom. |
| — | V6 — `/treebank` 307-redirected to `?q=&upos=&deprel=` | `validateSearch` normalised absent params to `""`. Empty values are now dropped, so the bare URL is the canonical one. |

**Decisions, and where I did not do what the plan said**

- **The leaderboard has no paper-transcribed rows.** You chose "verified seed + submission path", and the verified seed is HF `model-index` — structured, machine-readable, and linked to its source. I could not extract paper-table numbers safely: `poppler` is unavailable, and `pypdf` text extraction jumbles the per-language tables in IndicTrans2 (arXiv:2305.16307) badly enough that a transcribed score would be a guess. The page says so in words and routes paper results through a submission form that requires the paper URL and the exact table. **No number on that page was typed by me.**
- **Feature 16 (native-speaker feedback) deferred, as you chose.** It needs three things that are decisions, not code: spam/abuse handling on a public write path, a named moderation owner, and a data-retention/consent note. The D1 binding already exists, so it is days of work once those are settled.
- **R5's transliteration engine is still absent** (carried over from Phase 3): `xlit-api.ai4bharat.org` does not resolve and `openodia` has no transliteration function. The playground marks it "not yet" rather than implying it.

**Gate results**

`tsc` 0 errors · `lint` 0 errors / 16 warnings · `test` 110/110 · `build` ok ·
Playwright at 375px, 1024px, 1280px and 1440px: 0 console errors on `/leaderboard`, `/papers`,
`/treebank` and `/`; 0 horizontal overflow with analysis tables and citations expanded; all 25
routes return their expected status.

Confirmed in-browser: leaderboard renders 10 benchmark tables with 40 model links and correct
per-metric sort direction; the treebank narrows 456 → 437 sentences on `upos=VERB` and 456 → 227
on `Case=Loc` with 28 tokens highlighted, English gloss and CoNLL-U analysis intact, and the URL
tracking the query; papers filter 180 → 83 on "Corpora & resources"; the header fits at every
width with all ten destinations reachable from the menu.

---

### Final end-to-end validation (all four phases together)

A 53-assertion script re-checks every claim in §5 against the running site, plus a Playwright
sweep of all 14 routes at 375px / 1024px / 1280px / 1440px on a clean browser session.

**Found and fixed**

| Found by | Fix |
|----------|-----|
| V5 at 375px — `/events` overflowed to 388px | Event cards are grid items, and `min-width:auto` let a long venue set the card's minimum width. Same root cause as the Phase 2 citation overflow; added `min-w-0`. The three directory grids already had it — `/events` was missed because Phase 1 only touched its data path. |
| V5 — `listedIn.length` threw on a stale loader payload | Only reproducible via HMR (component reloaded ahead of its loader data), but a deploy could hit the same shape. `listedIn = []` now defaults in the destructure. |

**Checked and *not* a defect**

- `/api` appeared to be missing `/api/resources` — the spec is served with `max-age=86400`, so
  the browser was rendering a day-old cached copy. Bypassing the cache lists "Unified catalog"
  with all six query parameters. The cache header is correct for a spec.
- `/about`'s decorative blur glows extend past the viewport but sit inside `overflow-hidden`
  parents, so they cause no scroll.

**Result**

`tsc` 0 errors · `lint` 0 errors / 16 warnings · `test` 110/110 · `build` ok ·
53/53 behavioural assertions · 0 console errors across all routes on a clean session ·
0 horizontal overflow at every width with citations and analysis tables expanded.

---

### Follow-up: facet counts were lying (reported after review)

**The bug.** Facet counts were computed over the *unfiltered* list, so they went
stale the moment a first filter was applied. With `License = Apache-2.0` active
(42 datasets), the Task facet still advertised "Translation (56)" — and selecting
it returned 4, or for some combinations nothing at all. A count that doesn't
survive being clicked is worse than no count.

**The fix.** `lib/facets.ts` now computes each facet against the *other* facets'
selections but not its own — standard disjunctive faceting. Selecting inside a
facet is OR (picking MIT must not hide Apache-2.0 beside it); across facets it is
AND. The invariant this buys: an option showing (n) with n > 0 returns exactly n,
and where that facet already has a value selected, adding another widens the OR
so the total grows past n. A positive count can never lead to a blank page.

`computeFacets` also replaced four hand-rolled filter/count blocks across
`/tools`, `/models`, `/datasets` and `/papers`, so the pages now share one
implementation instead of four that could drift.

**The design question it raised.** What should an option that has dropped to zero
look like? Hiding it makes the row jump every time a filter changes and hides the
shape of the data; leaving it clickable is the bug. So there are three chip
states, distinguished by border treatment — solid (available), filled neon
(selected), dashed + dimmed + `disabled` + explanatory `title` (out of reach).
Zero options sort last, a *selected* option is never disabled (you must be able
to undo what emptied the page), and counts are set in tabular figures so a chip
does not change width when 44 becomes 8.

`/treebank` had the same bug plus a subtler one: its facets counted *tokens*
while its results are *sentences*. Both counts are now cross-filtered and
counted in sentences — `deprel=root` takes the part-of-speech facet from
"NOUN 446 / VERB 437" to "VERB 426 / NOUN 14", which is both correct and
linguistically obvious in hindsight.

**Found while validating this**

| Found by | Fix |
|----------|-----|
| A duplicate React key on `/papers` | Papers were deduplicated by normalised title only, so one work indexed under two title spellings kept both records sharing a DOI — and React drops rows on duplicate keys. Records now merge on DOI *or* title, and the survivor takes the merge key as its id, unique by construction. 180 → 178 papers. |
| The test for that fix | `(doi && map.get(doi)) ?? …` returns `""` for a missing DOI, and `??` does not fall through on `""` — so **every DOI-less paper would have collapsed into a single record**. Caught before it shipped because the test asserted uniqueness rather than just "it dedupes". |

**Verification**

Unit: a property test walks 8 filter combinations × every facet × every option
and asserts the count matches the result exactly (or widens, within a facet).
Tests 124 → 144.

In-browser: on `/tools`, 42 option selections across all four facets with a hard
reset between each — **42/42 exact, 0 failures, 27 zero-count options seen and 0
of them clickable**. On `/datasets`, `License = Apache-2.0` takes Task from
"Text Generation (107)" to "Other (13) / Text Generation (8) / Translation (4)",
and each of those returns exactly what it promises. `/papers` 180 → 64 on a year
filter with 12/12 exact. `/treebank` 5/5 exact.

Gate re-run: `tsc` 0 errors · `lint` 0 errors / 16 warnings · `test` 157/157 ·
`build` ok · 53/53 end-to-end assertions · 0 console errors.

---

## 6. What is left

Not attempted, and why — so the next pass starts from the truth rather than this document's
original optimism.

| Item | Status |
|------|--------|
| B5 contributors grid | Untouched. Needs the KV data to be checked in production; locally it is always the fallback state. |
| B9 taxonomy conflation on /tools | Partly addressed — the badge now reads "Curated" rather than "Tool", and models/datasets have consistent task labels. The deeper fix is one type vocabulary across all sources. |
| B11 marquee double-read | Untouched (one `aria-hidden` on the duplicated half). |
| B14 analytics privacy notice | Untouched. Session-replay recording still runs with no notice — a policy decision, not a code one. |
| C4–C6, C9–C12, C14, C16, C19, C21, C23 | Untouched. C17 and C18 are done; C7, C8, C13, C20, C22 are done. |
| UX 4 Odia typography, 9 PWA/offline, 10 contrast audit, 11 ⌘K hint, 14 leaderboard opt-out | Untouched. |
| Odia UI coverage | Still nav-chrome only (13 keys). `lang="or"` remains over-declared for page bodies. |
| 9 dead links in Awesome-Odia-AI | Found by the new checker; fixing them is a PR to that repo. |
