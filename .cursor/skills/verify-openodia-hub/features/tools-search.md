# Directory search and filters

Search and facet filtering over the curated catalog.

## Sub-features

- Free-text search box, `/` focuses it
- Empty state with "Clear search"
- Facet filters (source, category, organisation, license) and task filter dialogs on `/models`, `/datasets`

## How to get to it (user POV)

Header nav "Tools" (or "Models", "Datasets"), then type in the search box under the featured cards.

## Driving it with drive.mjs

```bash
"${VERIFY_NODE:-node}" $S/drive.mjs /tools "fill:Search projects, repos, datasets, models… [/]=fixture-no-match-93817" "expect:No projects match" "fill:Search projects, repos, datasets, models… [/]=" "expect:Sua"
```

Proof: screenshot shows `No projects match "fixture-no-match-93817".` then the "Sua" card returns. Cross-check `GET /api/resources?q=sua` returns `total: 1` with name `Sua`.
Facet dialogs: `page.getByRole("dialog", { name: "Filter by Task" })` as in `test/e2e/flows.spec.ts`.

## Gotchas

- The placeholder contains a Unicode ellipsis `…`; copy it exactly.
- Card images are external and blocked, so they render as broken image boxes. Expected.
