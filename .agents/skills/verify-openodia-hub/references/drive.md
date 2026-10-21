# drive.mjs

`scripts/drive.mjs` opens one page of the fixture Worker in headless Chromium, runs a list of steps and keeps the evidence. Run it with Node 22+ from the repo root against a Worker started from `test/e2e/serve.mjs`:

```bash
VERIFY_PORT=9171 node .agents/skills/verify-openodia-hub/scripts/drive.mjs <path> [step ...]
```

| Variable              | Default                           | Meaning                                                                 |
| --------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `VERIFY_PORT`         | `9171`                            | Port of the fixture Worker.                                             |
| `VERIFY_EVIDENCE`     | `/tmp/verify-openodia-hub/<port>` | Where screenshots, responses and the summary go.                        |
| `VERIFY_ALLOW_STATUS` | empty                             | Comma-separated `STATUS METHOD PATH` entries a journey expects to fail. |

## Steps

Each step is `verb:argument`. Only the first `:` splits it, and `fill` and `storage` split their argument at the first `=`, so values can contain both.

| Step                               | Does                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `fill:<placeholder>=<value>`       | Types into the input with that placeholder.                                 |
| `click:<name>`                     | Clicks the button whose accessible name contains `<name>`.                  |
| `link:<name>`                      | Clicks the first matching link and records the destination's server status. |
| `press:<key>`                      | Presses a key, such as `Control+k`.                                         |
| `expect:<text>`                    | Waits up to 15 s for the text to be visible.                                |
| `goto:<path>`                      | Loads another path.                                                         |
| `reload`                           | Reloads the current page.                                                   |
| `storage:<key>=<value>`            | Checks a `localStorage` value.                                              |
| `attr:<selector>\|<name>\|<value>` | Checks an attribute of the first match.                                     |
| `h1:<prefix>`                      | Checks that the first `h1` starts with the prefix.                          |

## What it does

- Blocks every request to another origin and fixes the page clock at 2026-10-12, the same date as the Worker.
- Waits for the network to go idle and for React to attach its handlers before the first step and after each load.
- Takes a screenshot after the load and after every step: `<run>-NN-<verb>.png`, where `<run>` is a millisecond timestamp.
- Saves every same-origin fetch or XHR response, including `/_serverFn/*`, as `<run>-api-NN-<path>.json` (method, status, headers, request body) and `.body`.
- Writes `<run>-drive.json` with `ok`, the last navigation `status`, every navigation, the failed step and the log, and prints it.

The run exits 1, and `ok` is `false`, when a step fails, a navigation answers 4xx or 5xx, a same-origin fetch answers 4xx or 5xx outside `VERIFY_ALLOW_STATUS`, the page throws, React logs a hydration error or evidence cannot be written. A failed step still writes the summary and a `failed` screenshot.

Steps cover single-page journeys. For dialogs, checkboxes or focus order, write a short Playwright script modelled on `test/e2e/*.spec.ts` and run it against the same port.
