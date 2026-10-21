# Feature map

Every journey runs against the fixture Worker from step 3 of the skill, from the repository root. Define `drive` once in the shell first:

```bash
drive() { node .agents/skills/verify-openodia-hub/scripts/drive.mjs "$@"; }
```

| Area                         | Entry points                            | Section                        |
| ---------------------------- | --------------------------------------- | ------------------------------ |
| Directory search and filters | `/tools`, `/models`, `/datasets`        | [Search](#search)              |
| Language toggle              | header button on every page             | [Language](#language)          |
| Command palette              | Ctrl+K, header search button            | [Palette](#palette)            |
| Playground                   | `/playground`                           | [Playground](#playground)      |
| Content pages                | the routes listed under Pages, `/r/...` | [Pages](#pages)                |
| Public API                   | `/api/*`, `/mcp`, Markdown negotiation  | [public-api.md](public-api.md) |

## Search

```bash
drive /tools "fill:Search projects, repos, datasets, models… [/]=fixture-no-match-93817" "expect:No projects match" "fill:Search projects, repos, datasets, models… [/]=" "expect:Sua"
drive /models "fill:Search models, authors, tags… [/]=fixture-no-match-93817" "expect:No models match" "fill:Search models, authors, tags… [/]=" "expect:Showing 2 of 2 models"
drive /datasets "fill:Search datasets, authors, tags… [/]=fixture-no-match-93817" "expect:No datasets match" "fill:Search datasets, authors, tags… [/]=" "expect:10M < n < 100M rows"
```

Each page keeps its own search state. The screenshots show the `No projects`, `No models` or `No datasets match "fixture-no-match-93817".` message and then the result grid again. Featured cards stay on screen while searching, so the `/models` and `/datasets` checks look for grid-only text: the `Showing 2 of 2 models` count and a dataset's `10M < n < 100M rows` size. The placeholder contains a Unicode ellipsis, so copy it exactly. The task filter dialogs on `/models` and `/datasets` need a Playwright script; `test/e2e/flows.spec.ts` shows the locators.

## Language

```bash
drive / "click:Switch language" "attr:html|lang|or" "attr:header|lang|or" "attr:main|lang|en" "storage:locale=or" "reload" "attr:html|lang|or" "attr:header|lang|or"
```

The run passes only when the header and `html` switch to Odia, `main` stays English, `localStorage.locale` is `or` and the choice survives a reload. Only the navigation, home hero, statistics and footer translate. Without an Odia font on the machine, Odia text renders as boxes in screenshots; the `lang` attributes are the proof.

## Palette

```bash
drive / "press:Control+k" "expect:Search OpenOdia"
```

Typing into the dialog needs a Playwright script: fill `getByRole("dialog").getByRole("combobox")` with `translate`, pick the option named `Help translate OpenOdia`, and expect that heading (as in `test/e2e/bilingual.mjs`). Check that `GET /api/search?q=translate` lists `/translation-status`.

## Playground

```bash
drive /playground "click:Odialang"
```

Running code needs a Playwright script: fill the textbox named `Odialang code editor` with `dekha "Browser verification"`, click Run and expect a `pre` containing `Browser verification` (as in `test/e2e/flows.spec.ts`). Python mode loads an external runtime that drive.mjs blocks, so only its failure state can be checked here.

## Pages

```bash
bad=""
while IFS='|' read -r path heading; do drive "$path" "h1:$heading" || bad="$bad $path"; done <<'ROUTES'
/events|Odia AI Events
/tutorials|One shared idea. Countless beginnings.
/communities|Communities & organizers.
/papers|Odia NLP papers.
/treebank|Odia treebank search.
/contribute|Add your project.
/about|Open source for ଓଡ଼ିଆ.
/translation-status|Help translate OpenOdia.
/api|OpenOdia API.
/r/gh/soumendrak/MTEnglish2Odia|MTEnglish2Odia
ROUTES
drive /events "link:Tools" "expect:Sua" || bad="$bad /events->/tools"
drive /communities "expect:TFUG Bhubaneswar" || bad="$bad /communities-organizers"
drive /tutorials "expect:LLM Compression" || bad="$bad /tutorials-videos"
counts="$(curl -sS "http://127.0.0.1:$VERIFY_PORT/api/translation-status" | jq -r '"\(.translated)/\(.total) ·"')"
drive /translation-status "expect:$counts" || bad="$bad /translation-status-counts"
[ -z "$bad" ] || { echo "FAILED:$bad"; false; }
```

Each run must exit 0 with status 200, and each `h1:` step must match the whole heading. Pages load their data through their own server functions, not through the public API, so the last three checks look at rendered data:

- `/communities` renders the checked-in `src/data/organizers.ts` and `src/data/events/`.
- `/tutorials` calls `loadVideos()`. `LLM Compression` is a recorded video; when loading fails, the page falls back to channel names only.
- `/translation-status` calls `getLocaleStatus()` and must show the same `translated/total` count that `/api/translation-status` reports.

`/events` and `/papers` have only the heading check. When a change touches their data, check the rendered rows as well, not only `/api/events` or the KV catalog.
