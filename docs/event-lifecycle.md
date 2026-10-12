# Reviewed event lifecycle and registration

This increment uses **version-controlled reviewed overrides** as the authoritative correction source. D1 keeps an additive cache of the reviewed fields for persistence and rollback safety. It does not become a public correction-authoring system. Maintainers review this contract and migration before release; no production migration runs as part of a pull request.

- Canonical event URL is identity. `community` and existing optional date-derived `status` remain backward compatible.
- Optional `lifecycle` carries scheduled/postponed/cancelled, official evidence URL, verification time, and replacement/original precise dates only when explicit. A rescheduled record exposes its replacement as the current startDate/year/date; old end dates are dropped unless a new end date was explicitly reviewed. Cancellation and unresolved postponement suppress upcoming/live recommendations even if the original date is future.
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

Unreviewed live data may fill or refresh ordinary fields. It cannot erase explicitly reviewed fields. Among reviewed corrections, the newer timestamp wins; equal timestamps preserve the existing review. `reviewedFields` identifies exactly what was corrected so reviewing cancellation does not freeze an unrelated upstream title. A newer correction can explicitly reset a lifecycle to scheduled. Unknown registration remains explicit and separate.

The crawler currently skips known canonical URLs. **This release is manual correction only for known-event updates.** It does not promise automatic detection of every cancellation. A new-source adapter is separate engineering work. Submit an event correction through the GitHub workflow, or a reviewed data PR when working from this branch without the organizer/correction forms PR merged.

## Additive D1 migration

Apply `db/migrations/0002_event_reviewed_metadata.sql` before rollout. It only creates `event_reviewed_metadata` with canonical identity, JSON reviewed-field payload and normalized timestamp. Reapplying it is safe; existing events rows/columns and records remain intact. Fresh databases also get the sidecar through `db/schema.sql`. This migration can coexist with #112's independent source-outcome migration.

Metadata persistence uses an upsert whose timestamp predicate prevents older reviewed writes from replacing newer evidence. Reads validate persisted JSON before admitting it. Corrupt payloads are ignored with a sanitized diagnostic. A legacy database without the sidecar keeps serving checked-in corrections; other database errors propagate to the existing API fallback rather than being concealed as successful empty data.

Verify migration locally before applying it remotely. This task does not deploy or migrate production.

## Public surfaces

- `/api/events` keeps the existing shape and carries additive lifecycle/registration/notices/review metadata when available. Dynamic data gains reviewed overrides without guessing upstream states.
- The Events page keeps cancelled/postponed entries visible with clear labels and evidence. Original dates on postponed entries are labeled as original; explicit replacement dates appear separately.
- Global search summaries state lifecycle and registration; known duplicate live records cannot shadow a reviewed cancellation.
- RSS prefixes cancellation/postponement/rescheduling in titles and includes state, registration and reviewed notices with escaped text.
- Structured data uses [EventCancelled](https://schema.org/EventCancelled), [EventPostponed](https://schema.org/EventPostponed), or [EventRescheduled](https://schema.org/EventRescheduled). Rescheduled entries use the replacement `startDate` and original `previousStartDate`.

No calendar export, public write endpoint, notifications or inferred registration states are added.
