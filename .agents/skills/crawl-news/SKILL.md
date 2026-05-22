---
name: crawl-news
description: >
  Discovers latest open-source Odia AI news from GitHub, Hugging Face, YouTube,
  and community channels. Writes blog posts in markdown format to src/content/blog/
  with YAML frontmatter. Use this when asked to "fetch latest Odia AI news",
  "update the blog", or "write a post about recent Odia AI developments".
---

# Crawl & Write Odia AI News

## Data architecture

Blog posts live in `src/content/blog/` as markdown files with YAML frontmatter.
Each post filename is the slug (e.g. `2026-05-20-odia-speech-model.md`).

Read `references/sources.md` for the list of news sources to crawl.

## Workflow

### 1. Check existing posts (deduplication)

Read all files in `src/content/blog/`. Collect all titles and URLs mentioned in
those posts to avoid duplicate coverage.

### 2. Fetch news from sources

For each source in `references/sources.md`:

a. **GitHub releases**: Check `odisha-ml`, `OdiaGenAI`, `OdiaNLP` orgs for new releases.
   Use gh CLI: `gh api "orgs/{org}/repos?sort=updated&per_page=5"` then check
   `gh api "repos/{owner}/{repo}/releases?per_page=3"` for each active repo.

b. **Hugging Face models**: Search for new Odia models.
   Use: fetch `https://huggingface.co/api/models?search=odia&sort=lastModified&direction=-1&limit=5`

c. **YouTube**: Check latest videos from tracked channels.
   Channels: OdiaGenAI, OpenOdia, Odias in ML, TFUG Bhubaneswar.

d. **GitHub Discussions**: Check for major announcements in `soumendrak/openodia-hub/discussions`.

e. **Awesome-Odia-AI**: Check recent commits for newly added tools.
   `gh api "repos/odisha-ml/Awesome-Odia-AI/commits?per_page=5"`

### 3. Identify newsworthy items

For each item found, determine if it's newsworthy:

- ✅ New model release or major update
- ✅ New dataset publication
- ✅ New tool/library launch
- ✅ Conference/workshop announcement with Odia AI content
- ✅ Research paper published with Odia language focus
- ✅ Major community milestone (100+ contributors, 10K+ downloads, etc.)
- ❌ Minor bug fixes, typo corrections, routine updates

### 4. Write blog post

For each newsworthy item, write a markdown file in `src/content/blog/`:

**Filename format**: `YYYY-MM-DD-slug.md` (e.g. `2026-05-20-new-odia-whisper-model.md`)

**Template**:

```markdown
---
title: "Clear, descriptive title in title case"
date: YYYY-MM-DD
author: "@openodia"
tags: [tag1, tag2]
excerpt: "One-sentence summary of the news, under 160 characters."
source_url: "https://github.com/org/repo/releases/tag/v1.0"
---

## What happened

2-3 sentences explaining the news clearly. What was released, by whom, and
why it matters for the Odia language community.

## Why it matters

2-3 sentences on the impact. How does this advance Odia in AI? What can
developers or researchers do with it now?

## Get started

Quick code snippet or link showing how to use the new tool/model/dataset.

```bash
# Example for a Python package
pip install new-odia-tool
```

## Links

- [GitHub Repository](https://github.com/...)
- [Documentation](https://...)
- [Hugging Face Model](https://huggingface.co/...)
```

### 5. Writing guidelines

- Write in clear, professional English. Avoid marketing fluff.
- Every post must answer: what, why, and how to get started.
- Credit the creators — link to their GitHub/HF profiles.
- Keep excerpts under 160 characters.
- Use tags consistently: `speech`, `models`, `datasets`, `tools`, `events`, `research`, `community`.
- If the news is about a person's work, tag `contributors`.

### 6. Report

After processing, report:

- ✅ New posts created (title, slug, source)
- ⏭ Items skipped (reason: not newsworthy, already covered, etc.)
- 📝 Sources checked with no new updates

## Rules

- Never duplicate a topic already covered in existing blog posts.
- One post per major news item. Bundle related minor updates into a roundup post.
- Always include `source_url` in frontmatter so readers can verify.
- Do not copy-paste verbatim from sources. Write original summaries.
- Respect the source's license — never republish full content, only summarize and link.
- For research papers, include the paper title, authors, venue, and arXiv link.
