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
- **Language:** Navigation strings live in `src/locales/en.ts` and `src/locales/or.ts`; missing translations fall back to English. Registered home hero/opening/statistics and footer strings also use this inventory. Other page bodies remain in their original language; `/translation-status` reports the exact scope and review state.
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

### Without code: submit an event

Organizers and attendees can use the
[Submit an event](https://github.com/soumendrak/openodia-hub/issues/new?template=event-submission.yml)
issue form instead of editing TypeScript. It is linked from `/contribute` and `/events`.

The form collects the fields of the `Event` record in `src/data/events/types.ts`, plus an evidence
URL and the date it was checked. Nothing is published automatically. A maintainer turns a reviewed
submission into a pull request, and the repository tests validate that record, not the issue text.

For example: "GDGoC KIIT · Build with AI", event URL
`https://gdg.community.dev/events/details/...`, registration URL left blank because the source
gives none, organizer `GDGoC KIIT (gdgoc-kiit)`, type `Workshop`, start date `2026-11-21` with
precision `Exact day`, format `In person`, attendance `eligibility` with the note "KIIT students
with college ID; 60 seats", registration `Unknown / not stated`, fee `Unknown / not stated`.

The canonical event URL is the event's identity, and listings are deduplicated by it. A
registration form, cohost alias, or tracking link is not the identity; put it in the separate
registration URL field.

Choose **Unknown / not stated** whenever the source is silent. An omitted fee is not "free", and
being listed does not mean registration is open.

The form adds records for review. Automatic collection from a new source still needs separate
engineering work on a crawler adapter (see `scripts/crawl-events.mjs` and `CHAPTERS`).

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

## Translate one string

1. Open [/translation-status](https://openodia.com/translation-status), search for a string, and follow its **Edit translation** link. The same inventory is available at `/api/translation-status`; presence and native review are reported separately.
2. Edit the matching structural key in `src/locales/or.ts`. Preserve placeholders, proper names and meaning. When registering new English UI copy, add its key to `src/locales/en.ts` and the explicit `ODIA_REVIEW_QUEUE` in `src/locales/review.ts`; untranslated tracked keys must have an explicit blank-string placeholder in `or.ts` (for example, `"new.key": ""`) while wording is in progress.
3. Run `bun run check:locales` and the normal contribution gates. Unknown keys, untracked English strings, missing placeholders, invalid Odia text and mismatched placeholders fail the inventory check.
4. Open a PR. Once the trusted workflow is installed on the default branch, it applies `needs-native-speaker-review` for locale wording and review-record changes and publishes a `native-review` commit status on the current PR head. A configured native reviewer must approve the current commit; an old approval or a label by itself is insufficient.
5. After native review, record the **exact translation**, reviewer and review date in `ODIA_REVIEWS`. Changed wording invalidates its old review record automatically. Do not mark draft or generated wording as reviewed.

Maintainers configure repository variable `ODIA_NATIVE_REVIEWERS` as comma-separated GitHub logins of actual native Odia reviewers. With no reviewers configured, the trusted publisher reports a failing status for translation changes. No reviewer is assumed from account ownership. For an agent-created PR authored through your own GitHub account, a configured native reviewer can instead post the exact comment `odia-review-approved <current full head SHA>` after reviewing the wording. `odia-review-revoke <current full head SHA>` revokes that comment approval; a new commit requires a new approval. Account ownership or chat intent does not constitute approval.

The publisher runs from trusted base/default-branch workflow code on PR target events, relevant reviewer comments, and completed review notifications. It queries current GitHub reviews/comments and publishes changed decisions on the PR's fresh head SHA. Manual default-branch refresh publishes a fresh `native-review` pending/final pair. Automatic signals reuse an equivalent latest publisher status only after recomputing current review evidence. Formal reviews and edited SHA comments share per-reviewer chronology; later rejection/dismissal overrides earlier approval, equal-time conflicts reject, and unknown dismissal timing blocks approval. The separate `pull_request_review` workflow has no token permissions and only signals that metadata needs another evaluation. Its job result, artifacts, and contributor-controlled code cannot authorize the published status. Fork notifications are resolved using GitHub APIs, including an open-PR fallback when run and commit associations are empty. Neither workflow checks out or executes PR application code with write permissions.

Comment-triggered evaluation accepts only a configured reviewer's exact current-head approval/revoke command. Editing a command into other text or deleting it also triggers reevaluation, including when another maintainer deletes the configured reviewer's comment. Unrelated, outsider and stale-head comments do not start the publisher or consume commit statuses. To request a fresh review-status check without expressing a decision, run **Native Odia review** manually on the default branch instead of posting an approval command merely to wake the workflow. If GitHub's capped file list is incomplete or inconsistent with the PR's canonical changed-file count, the publisher reports an error and keeps any existing review label; split PRs larger than 3,000 files rather than treating unseen locale changes as reviewed.

Default-branch reconciliation also discovers all open PRs every five minutes, independently of the contributor-controlled notification. It rereads current review metadata every time, writes changed decisions and avoids repeated failure notifications for routine missing approval; the commit status still blocks merging. GitHub can delay or drop scheduled runs and disable them after prolonged repository inactivity, so a previous successful status can remain stale after dismissal. If a review signal was missed, run **Native Odia review** manually with the default branch selected; other refs are rejected. Before merging, verify the completed `native-review` status on the unchanged current PR head and check that its approval remains valid in the current review state. See [GitHub's schedule constraints](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

For the first PR that installs these workflows, obtain and verify actual native approval of the final head manually before merging: the trusted publisher is not yet installed on the default branch. Do not use a rerun of a PR-controlled review job as proof of approval. After landing and observing a trusted published status, require the **`native-review` commit status** in main branch protection/rulesets; keep the publisher/notification job names distinct from that context. If a contributor creates a same-named successful check, GitHub requires both the check and the status to pass, so it cannot replace a failing trusted status. Existing PRs can refresh the installed publisher through manual default-branch dispatch or a relevant configured-reviewer command change. See [workflow event requirements](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) and [required-status behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

The initial 46-string batch includes navigation, the home hero/opening/statistics, and the footer. It is translated draft copy pending native review, not a claim that all upstream descriptions or all page bodies are translated.
