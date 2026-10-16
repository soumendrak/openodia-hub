# Language toggle

Switches navigation, home hero, statistics and footer between English and Odia; persisted in localStorage `locale`.

## Sub-features

- Header button "Switch language"
- `/translation-status` inventory with search box "Find a string"

## How to get to it (user POV)

Click the translate icon button in the header on any page.

## Driving it with drive.mjs

```bash
"${VERIFY_NODE:-node}" $S/drive.mjs / "click:Switch language" "attr:html|lang|or" "attr:header|lang|or" "attr:main|lang|en" "storage:locale=or" "reload" "attr:html|lang|or" "attr:header|lang|or"
```

Proof: the run exits 0 only if `localStorage.locale` is `or` and the Odia `lang` attributes survive a reload, and after the click `html[lang=or]`, `header[lang=or]` and `main[lang=en]` (from `test/e2e/accessibility.spec.ts`), and the screenshot shows Odia navigation.

## Gotchas

- Page bodies other than the home hero stay English by design; only the scoped strings translate.
- Clicking before hydration does nothing; `drive.mjs` waits for networkidle first.
- The box has no Odia system font and the harness blocks web fonts, so Odia text renders as tofu boxes in screenshots. Prove the switch with the header button now reading "English" and the `lang` attributes, or install `fonts-noto-core` for readable screenshots.
