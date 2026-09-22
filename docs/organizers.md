# Organizer identity and evidence

`src/data/organizers.ts` is the published organizer registry. It owns stable IDs, canonical display
names, reviewed aliases, descriptive metadata, official destinations, and collection mode. It is
safe to import from browser or server code: it has no React, crawler, filesystem, or network
dependencies.

## Compatibility contract

- `Event.community` remains the human-readable field used by existing API and UI consumers.
- `Event.organizerId` is additive. Checked-in and live configured events receive it from the
  registry; consumers must tolerate it being absent on old D1 records or unknown external data.
- Resolve old names with `resolveOrganizer`, `resolveOrganizerId`, or `resolveOrganizerName`.
- An unknown name remains unresolved. Keep the supplied `community` string at an external boundary,
  omit `organizerId`, and flag it for maintainer review; never manufacture an ID or metadata.

## Adding or changing an organizer

1. Start from primary evidence: the organizer's own site or community page. A research candidate is
   not publishable merely because it appears in `research/odisha-event-radar/`.
2. Confirm with a maintainer that the candidate is a distinct organizer rather than an alias,
   chapter, co-host, or renamed group.
3. Add one lowercase, URL-safe, durable `id`; a concise canonical name and description; reviewed
   legacy aliases; region; organization kind; and collection mode.
4. Add official links with the evidence URL, a factual verification note, and the date the evidence
   was actually checked. Use `null` when that date is not known; do not backfill a guessed date.
5. Add the organizer ID to an event source only after the identity review. Run the registry tests so
   duplicate aliases, invalid links, and unresolved checked-in event organizers fail review.

Collection mode describes editorial collection, not runtime health:

- `automated`: a configured adapter collects the source.
- `partial`: automation covers only a known subset.
- `manual`: a human or agent reviews the source.
- `archive-only`: historical events remain for identity and deduplication, but the source is not
  actively fetched.

Do not infer uptime, freshness, completeness, registration state, or source quality from these
values. Those require separate runtime observations.

## Evidence boundaries

Official-link evidence establishes only that the destination belongs to the organizer. Event
attendance, eligibility, fees, approval, and registration availability stay on each `Event` as
edition-specific evidence. A historical invitation never creates an organizer-wide attendance
policy.

For an unresolved candidate, retain its discovery evidence in research or a review report until the
maintainer confirms identity and official destinations. Do not add speculative aliases, social
handles, descriptions, verification dates, or an organizer-wide attendance claim.
