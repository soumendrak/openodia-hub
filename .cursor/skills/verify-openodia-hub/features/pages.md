# Content pages

Server-rendered pages without their own feature file. Each is checked by loading it in the browser (status, h1, hydration, screenshot) and, when the change touches its data, the API it reads.

## Sub-features and entry points

| Route                 | h1 starts with (fixture Worker) | Data source                       |
| --------------------- | ------------------------------- | --------------------------------- |
| `/events`             | `Odia AI Events`                | `/api/events` (recorded GDG feed) |
| `/tutorials`          | `One shared idea.`              | `/api/videos`                     |
| `/communities`        | `Communities & organizers.`     | catalog KV                        |
| `/papers`             | `Odia NLP papers.`              | catalog KV                        |
| `/treebank`           | `Odia treebank search.`         | static                            |
| `/contribute`         | `Add your project.`             | static form                       |
| `/about`              | `Open source for ଓଡ଼ିଆ.`        | static                            |
| `/translation-status` | `Help translate OpenOdia.`      | `/api/translation-status`         |
| `/api`                | `OpenOdia API.`                 | static                            |
| `/r/<kind>/<id>`      | resource detail                 | resource store                    |

## How to get to it (user POV)

Header and footer navigation, or a direct URL.

## Driving it

```bash
for p in /events /tutorials /communities /papers /treebank /contribute /about /translation-status /api; do node $S/drive.mjs "$p" || echo "FAILED $p"; done
node $S/drive.mjs /events "link:Tools" "expect:Sua"
```

Proof: each run exits 0, `status` is 200, `h1` matches the table, no `pageerror` or `hydration` lines, and the screenshot shows the page. Client-side navigations save their `/api/*` and `/_serverFn/*` responses as `<run>-api-NN-*.json` (status, headers) and `.body` files in evidence.

## Gotchas

- `/r/gh/soumendrak/MTEnglish2Odia` returns 404 under the fixture Worker: the seeded catalog does not include resource-detail records. A change to the detail page cannot be proven with this harness yet; report that and prove it with the route's unit tests and a preview deploy instead of weakening the journey.
