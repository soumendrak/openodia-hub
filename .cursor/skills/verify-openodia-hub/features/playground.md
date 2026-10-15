# Playground

Runs Odialang locally in the browser, Python examples via an external runtime, and Indic transliteration.

## Sub-features

- Odialang mode (local, works offline)
- Python mode (external runtime, blocked in the harness)
- Transliteration

## How to get to it (user POV)

Header nav "Playground".

## Driving it with drive.mjs

```bash
node $S/drive.mjs /playground "click:Odialang"
```

Then in a custom script: fill `getByRole("textbox", { name: /Odialang code editor/ })` with `dekha "Browser verification"`, click "Run", expect a `pre` with "Browser verification" (from `test/e2e/flows.spec.ts`).

## Gotchas

- Python mode needs the external runtime, which the harness blocks; verify only its failure state locally.
