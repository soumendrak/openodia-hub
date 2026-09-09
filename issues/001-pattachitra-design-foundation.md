## Parent design plan

`plan.md`

## What to build

Create the reusable production foundation for the approved Pattachitra direction: locally served art assets, font loading, semantic colour and spacing tokens, decorative border primitives, and motion primitives. The foundation must use the exact Noto Sans Oriya contour for the large hero letter and retain the artwork provenance recorded in the mockup.

## Acceptance criteria

- [ ] Production-owned assets are added under `public/` with source and licence notes retained in repository documentation.
- [ ] The theme exposes semantic tokens for palm-leaf ochre, ink, vermilion, antique gold, ivory, lines, and surface states.
- [ ] Shared border, ornamental-panel, button, and display-type treatments work from 320px through desktop widths without horizontal overflow.
- [ ] The exact `ଓ` (U+0B13) remains an inspectable SVG/React asset; it is not substituted with a generated or hand-redrawn glyph.
- [ ] Motion uses compositor-friendly transforms and opacity only; `prefers-reduced-motion` removes decorative movement while leaving the interface usable.

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1: A visitor immediately recognises the homepage as a refined, Odia-rooted experience.
- User story 5: A visitor who reduces motion is not exposed to decorative motion.
