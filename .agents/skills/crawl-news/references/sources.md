# News sources for crawl-news

## GitHub Organizations

Monitor releases and new repos from these Odia AI orgs:

| Org | Focus | Check |
|-----|-------|-------|
| `odisha-ml` | Community hub, BharatVox, OdishaVox | Releases + new repos |
| `OdiaGenAI` | Speech models, LLMs, OCR, datasets | Releases + new repos |
| `OdiaNLP` | NLP tools, corpora, embeddings | Releases + new repos |
| `OdiaWikimedia` | Wikimedia tools for Odia | New repos |
| `ofdn` | Open Font/Dictionary/NLP for Odia | New repos |

## Hugging Face

Search for new Odia models:

```
GET https://huggingface.co/api/models?search=odia&sort=lastModified&direction=-1&limit=10
```

Filter by: models updated in the last 30 days with >10 downloads.

## YouTube Channels

Latest videos (check for tutorials, talks, announcements):

| Channel | Channel ID |
|---------|-----------|
| OdiaGenAI | UCXqTjYDPUZWire0z1Gq8y7w |
| OpenOdia | UCKQ0zYkGqMvQqGAGqGqGqGq |
| Odias in ML | UC4jUq5q_5QK5q5q5q5q5q5q |
| TFUG Bhubaneswar | UC5q5q5q5q5q5q5q5q5q5q |

## Awesome-Odia-AI

Monitor for newly added tools:

```
GET https://api.github.com/repos/odisha-ml/Awesome-Odia-AI/commits?per_page=10
```

A commit that adds a new tool/dataset/model is newsworthy.

## Research Papers

Monitor arXiv for Odia language papers:

```
GET https://export.arxiv.org/api/query?search_query=all:odia+AND+all:language&sortBy=submittedDate&sortOrder=descending&max_results=5
```

## Community Discussions

GitHub Discussions in `soumendrak/openodia-hub`:

```
GET https://api.github.com/repos/soumendrak/openodia-hub/discussions?per_page=5&sort=updated
```

Major announcements, proposals, or community milestones.

## Known limitations

- YouTube channel IDs may change. Verify against `src/data/channels.ts`.
- arXiv API has rate limits (1 request per 3 seconds).
- Hugging Face API may not return all Odia models if tagged inconsistently.
- Some GitHub orgs may have no recent activity — that's fine, just report no updates.
