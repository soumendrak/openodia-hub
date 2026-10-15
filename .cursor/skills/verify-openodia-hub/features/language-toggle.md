# Language toggle

Switches navigation, home hero, statistics and footer between English and Odia; persisted in localStorage `locale`.

## Sub-features

- Header button "Switch language"
- `/translation-status` inventory with search box "Find a string"

## How to get to it (user POV)

Click the translate icon button in the header on any page.

## Driving it with drive.mjs

```bash
node $S/drive.mjs / "click:Switch language"
```

Proof: after-click screenshot shows Odia navigation; in a custom script assert `html[lang=or]`, `header[lang=or]` and `main[lang=en]` (from `test/e2e/accessibility.spec.ts`).

## Gotchas

- Page bodies other than the home hero stay English by design; only the scoped strings translate.
- Clicking before hydration does nothing; `drive.mjs` waits for networkidle first.
- The box has no Odia system font and the harness blocks web fonts, so Odia text renders as tofu boxes in screenshots. Prove the switch with the header button now reading "English" and the `lang` attributes, or install `fonts-noto-core` for readable screenshots.
