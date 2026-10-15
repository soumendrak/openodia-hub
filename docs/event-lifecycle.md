# Reviewed event lifecycle and registration

This increment uses **version-controlled reviewed overrides** as the authoritative correction source. D1 keeps an additive cache of the reviewed fields for persistence and rollback safety. It does not become a public correction-authoring system. Maintainers review this contract and migration before release; no production migration runs as part of a pull request.

- Canonical event URL is identity. `community` and existing optional date-derived `status` remain backward compatible.
- Optional `lifecycle` carries scheduled/postponed/cancelled, official evidence URL, verification time, and replacement/original precise dates only when explicit. `previousDate` is valid only for a postponed lifecycle. A rescheduled record exposes its replacement as the current startDate/year/date; old end dates are dropped unless a new end date was explicitly reviewed. Cancellation and unresolved postponement suppress upcoming/live recommendations even if the original date is future.
- Optional `registration` carries unknown/not-open/open/closed/sold-out/waitlist. Known states require official evidence and a verification time. It never changes attendance eligibility. No fee is inferred.
- `notices` hold reviewed venue/time/registration/postponement/cancellation changes, text, evidence and verification time. They are bounded to 20 notices and 1,000 characters per notice.
- Legacy events retain optional absent fields; absence means unknown, not scheduled-by-evidence, registration open, or free.

## Reviewed corrections and merge precedence

Add a record to `src/data/event-overrides.ts` with the canonical `url`, `evidenceUrl`, review timestamp, and an explicit `patch`. Native type checking and `validateOverrides` reject invalid states, duplicate URL aliases, guessed dates, missing evidence, unsafe URLs and invalid timestamps. The production registry starts empty; synthetic verification events are never published.

```ts
{
  url: "https://organizer.example/events/workshop",
  evidenceUrl: "https://organizer.example/notices/cancellation",
  reviewedAt: "2026-10-12T12:00:00Z",
  patch: {
    lifecycle: {
      state: "cancelled",
      evidenceUrl: "https://organizer.example/notices/cancellation",
      verifiedAt: "2026-10-12T12:00:00Z",
    },
    notices: [{
      kind: "cancellation",
      text: "The organizer cancelled this workshop.",
      evidenceUrl: "https://organizer.example/notices/cancellation",
      verifiedAt: "2026-10-12T12:00:00Z",
    }],
  },
}
```

Unreviewed live data may fill or refresh ordinary fields. It cannot erase explicitly reviewed fields. Among reviewed corrections, the newer timestamp wins. Equal timestamps preserve existing values for conflicting fields and atomically union independent fields, including concurrent date-only reviews. `reviewedFields` identifies exactly what was corrected so reviewing cancellation does not freeze an unrelated upstream title. A newer correction can explicitly reset a lifecycle to scheduled. Unknown registration remains explicit and separate.

The crawler currently skips known canonical URLs. **This release is manual correction only for known-event updates.** It does not promise automatic detection of every cancellation. A new-source adapter is separate engineering work. Submit an event correction through the GitHub workflow or a reviewed data PR.

## Additive D1 migration

Apply the migrations in `db/migrations` in order: `0001_event_source_outcomes.sql`, `0002_event_reviewed_metadata.sql`, then `0003_event_destination_aliases.sql` (`wrangler d1 migrations apply openodia-events`; `wrangler.jsonc` sets `migrations_dir`). The additive tables keep reviewed fields separate from automatic URL observations. Reapplying them is safe; existing event rows remain intact. Fresh databases also receive these tables from the combined `db/schema.sql`.

Every checked-in override is cached during sync, including curated-only or upstream-removed URLs, without creating fabricated base event rows. Sync restores reviews over the whole curated and previously stored corpus before canonicalizing aliases; admitted review facts are copied to the canonical sidecar even when every chapter returns empty or the old base row is absent or expired. Deleting the old alias sidecar therefore cannot erase the canonical correction. Metadata persistence uses an upsert whose timestamp predicate prevents older reviewed writes from replacing newer evidence. Equal-timestamp writes merge whole fields atomically, preserving existing conflict values. Reads validate persisted JSON before admitting it. Corrupt payloads are ignored with a sanitized diagnostic. A legacy database without the sidecar keeps serving checked-in corrections; other database errors retain a checked-in/live fallback marked partial. A failed initial read is not retried through the metadata sidecar. Partial API/RSS/search responses do not claim complete reviewed state.

Verify migration locally before applying it remotely. This task does not deploy or migrate production.

## Bounded destination sync

Catalog warming stays on `0 */6 * * *`; event sync has its own `15 */6 * * *` invocation (00:15, 06:15, 12:15, 18:15 UTC). It does not load catalog sources. Cloudflare cron changes can take up to 15 minutes to propagate.

The event invocation reads each chapter once, without retries or automatic redirects; its deadline includes response-body parsing. HTTP, network, timeout and malformed-state failures remain failed outcomes, mark live fallback API/RSS/search partial, and prevent retirement. A chapter retires rows only when its upcoming list is complete (its `count` matches its results with no next page); with an incomplete past list only future-dated rows may retire.

Destination discovery runs only in sync. Unseen URLs precede the oldest observations; at most 30 candidates run with three concurrent resolvers. Every HEAD attempt and redirect hop spends the same 30-request budget, with five hops and a five-second deadline per candidate. Unattempted URLs remain unseen for the next run; failures retain a previously confirmed alias. Five chapter GETs plus at most 30 HEADs means at most **35 external requests** for the whole event invocation, below [Workers Free's 50-request limit](https://developers.cloudflare.com/workers/platform/limits/#subrequests). Catalog warming has a separate budget.

Alias observations, reviewed metadata and event upserts use JSON-bound bulk SQL. A sync uses at most **3 × chapters + 7 D1 queries** (22 at today's five chapters, 34 at nine): one snapshot read of events, reviewed sidecars and aliases; one upsert, membership write and deactivation per chapter; and one alias write, review write, legacy-membership migration, status write, removed-chapter deactivation and retirement. `syncEventsToD1` refuses to start, before any fetch or write, when that count would exceed 50. Each write binds at most three parameters, below [D1 Free's 50-query and 100-parameter limits](https://developers.cloudflare.com/d1/platform/limits/). Reviewed alias facts are merged into the live canonical record and sidecar before the old base row retires. The original review timestamp and field precedence survive; crawl time never authorizes a review, and checked-in overrides remain authoritative.

## Public surfaces

- `/api/events` keeps the existing shape and carries additive lifecycle/registration/notices/review metadata when available. Dynamic data gains reviewed overrides without guessing upstream states.
- The Events page keeps cancelled/postponed entries visible with clear labels and evidence. Original dates on postponed entries are labeled as original; explicit replacement dates appear separately.
- Global search summaries state lifecycle and registration; known duplicate live records cannot shadow a reviewed cancellation. API, SSR, RSS and default search consume the same complete canonical corpus rather than adding the raw archive again. After alias deduplication, the loader restores newer canonical sidecar reviews, including corrections without a canonical base row. Injected raw arrays in search retain the archive-merge contract. These surfaces follow stored destination aliases without issuing any HEAD requests, even when reviewed dates differ. Missing aliases retain their source URL until a later sync observes them. Only HTTPS GDG event-detail URLs without credentials are admitted.
- Active opportunities precede historical records before API pagination; dates and URL identity provide stable ordering. A dedicated registration-page link exposes an explicitly supplied destination independently from evidence.
- RSS prefixes cancellation/postponement/rescheduling in titles and includes state, registration and reviewed notices with escaped text. It sorts a copy of the canonical corpus by descending year and known start date, preserving API active-first ordering and never inventing a date for a year-only event.
- Structured data uses [EventCancelled](https://schema.org/EventCancelled), [EventPostponed](https://schema.org/EventPostponed), or [EventRescheduled](https://schema.org/EventRescheduled). Rescheduled entries use the replacement `startDate` and original `previousStartDate`.

No calendar export, public write endpoint, notifications or inferred registration states are added.
