# PR #130 post-merge CI repair

Failed run: https://github.com/soumendrak/openodia-hub/actions/runs/38451219108/job/115482533286
Source: `7b5d85236346ed838f3696dd75167c2543c391f6`.

The Linux built-Worker suite passed 65/66 cases and failed only `visual /events`:
21,245 pixels differed (about 3%), exceeding the unchanged 0.015 tolerance.
PR #130 intentionally adds the event-correction link, wrapping the introductory
paragraph and shifting the filters/cards downward. Both CI expected and actual
screenshots were inspected before accepting the change.

The events baseline is replaced with the actual Linux screenshot from that exact
failed run, rather than regenerating an image on another platform. No production
source, fixture, comparison threshold, or test is changed. The original macOS
visual run passed all six images with the old baseline; it did not reproduce the
Linux failure, demonstrating why the Linux artifact is the appropriate evidence.

After replacement, the independent macOS visual run passed all six screenshots
without snapshot-update mode. Frozen installation and the production build passed.
The focused repair PR runs the full Linux API, UX, axe and screenshot suite.
