## Parent design plan

`plan.md`

## What to build

Add focused automated coverage and release validation for the new visual direction. The goal is to make the culturally important details — exact glyph, phrase, channel attribution, motion choice, and responsive clearance — difficult to regress after the initial implementation.

## Acceptance criteria

- [ ] Tests cover the exact Odia phrase, GDG channel registration, key homepage/tutorial links, and reduced-motion behaviour or an equivalent deterministic contract.
- [ ] A browser-level check covers 320px, 390px, tablet, and desktop layouts with no horizontal overflow and loaded hero assets.
- [ ] A browser-level check confirms that the hero letter clears both peacocks at animation start, midpoint, and loop end.
- [ ] `pnpm lint`, `pnpm test`, and `pnpm build` pass; `just coverage` remains the final repository completion gate.
- [ ] Asset provenance and the Pattachitra inspiration/source notes are present in repository docs.

## Blocked by

- Blocked by `issues/002-pattachitra-homepage.md`.
- Blocked by `issues/003-pattachitra-site-chrome.md`.
- Blocked by `issues/004-pattachitra-tutorials.md`.

## User stories addressed

- User story 1: The distinctive hero remains correct after future changes.
- User story 3: Tutorial discovery remains available after visual work.
- User story 5: Motion preferences remain respected.
