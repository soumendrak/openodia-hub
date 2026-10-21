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

| Step                               | Does                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `fill:<placeholder>=<value>`       | Types into the input with that placeholder.                             |
| `click:<name>`                     | Clicks the button whose accessible name contains `<name>`.              |
| `link:<name>`                      | Clicks the first matching link and records where it points (see below). |
| `press:<key>`                      | Presses a key, such as `Control+k`.                                     |
| `expect:<text>`                    | Waits up to 15 s for visible text containing `<text>`, ignoring case.   |
| `goto:<path>`                      | Loads another path.                                                     |
| `reload`                           | Reloads the current page.                                               |
| `storage:<key>=<value>`            | Checks a `localStorage` value.                                          |
| `attr:<selector>\|<name>\|<value>` | Checks an attribute of the first match.                                 |
| `h1:<prefix>`                      | Checks that the first `h1` starts with the prefix.                      |

## What it does

- Blocks every request to another origin, in new tabs too, and fixes the page clock at 2026-10-12, the same date as the Worker.
- Waits for the network to go idle and for React to attach its handlers before the first step and after each load.
- After every step, waits until no same-origin request has started or finished for 750 ms, so requests a step schedules on a timer, such as the palette search, are saved and checked. A request still open after 15 s fails the run as `settle timeout`.
- For `link`, records the server status of a same-origin destination and marks any other destination `external`. Redirects are followed only while they stay on the Worker's origin, at most five. A link that opens a new tab is handled the same way, and the tab is closed.
- Takes a screenshot after the load and after every step: `<run>-NN-<verb>.png`, where `<run>` is a millisecond timestamp.
- Saves every same-origin fetch or XHR response, including `/_serverFn/*`, as `<run>-api-NN-<path>.json` (method, status, headers, request body) and `.body`.
- Writes `<run>-drive.json` with `ok`, the last navigation `status`, every navigation, the failed step and the log, and prints it.

The run exits 1, and `ok` is `false`, when a step fails, a navigation answers 4xx or 5xx, a same-origin fetch answers 4xx or 5xx outside `VERIFY_ALLOW_STATUS`, the page throws, React logs a hydration error, Chromium fails to start or evidence cannot be written. A failure before the first step is labelled `launch` (Chromium or the evidence directory), `setup` or `load` (the first page) in `failed.step`. Responses still unsaved 5 s after the run fail it with `evidenceerror`, and redirect responses are saved with an empty body. A failed run still prints the summary, writes it when it can, and a failed step also saves a `failed` screenshot.

Steps cover single-page journeys. For dialogs, checkboxes or focus order, write a short Playwright script modelled on `test/e2e/*.spec.ts` and run it against the same port.
