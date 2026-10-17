# Command palette

Cross-site search and navigation dialog named "Search OpenOdia".

## Sub-features

- Ctrl+K / Cmd+K shortcut
- Header search button
- Results from `/api/search`

## How to get to it (user POV)

Press Ctrl+K anywhere, type, pick an option.

## Driving it with drive.mjs

```bash
"${VERIFY_NODE:-node}" $S/drive.mjs / "press:Control+k" "expect:Search OpenOdia"
```

Typing into the dialog needs a custom script: `page.getByRole("dialog").getByRole("combobox").fill("translate")`, then click option `/Help translate OpenOdia/` and expect heading "Help translate OpenOdia." (from `test/e2e/bilingual.mjs`). Cross-check `GET /api/search?q=translate` contains href `/translation-status`.

## Gotchas

- The shortcut only binds after hydration.
