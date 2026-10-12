# Translation status design reference

Direct build within the existing OpenOdia system, following the Refero design workflow. Primary reference: current `/communities` directory; secondary reference: current `/contribute` path and contribution guidance. Bundled craft reference: focus, forms, semantics and responsive rules in Refero `references/craft-details.md`.

| Decision                                                                 | Reference                                                  | Purpose                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Existing page width, display heading, surface/border/foreground tokens   | Communities route and existing palette                     | Match the application without a visual redesign                   |
| Separate presence and reviewed counts before the string list             | Issue57 evidence/review requirements                       | Prevent draft copy being mistaken for approved translations       |
| Search label, checkbox label, live result count and explicit empty state | Directory controls plus Refero craft rules                 | Keyboard and screen-reader usable contribution discovery          |
| Single-column strings with wrapped keys and separately marked Odia text  | Existing contributor audience and narrow-layout constraint | Inspect exact wording on phones without horizontal scrolling      |
| Real edit links and one-string contribution guide                        | Contribute route                                           | Make the next action concrete without a new public write endpoint |

Draft status is a content fact, not a decorative badge. Presence covers the registered inventory only; the page explicitly states that upstream content and other page bodies remain untranslated. Human linguistic review is not inferred from tests.
