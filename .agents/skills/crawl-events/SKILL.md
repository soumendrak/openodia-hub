---
name: crawl-events
description: >
  Crawls Odia AI community event pages to discover new past, live, or upcoming events
  and updates the appropriate source file in src/data/events/. Use this skill when the
  user asks to "check for new events", "refresh events", "sync events from source pages",
  or "update the events page". Also handles unparsable pages gracefully.
---

# Crawl & Sync Events

## Data architecture

Each community has its own file in `src/data/events/`. The barrel `src/data/events/index.ts`
imports and merges all of them. **Only edit the community files — never edit index.ts data.**

Read `references/sources.md` for the full list of community source URLs, their matching
data files, parsability status, and known limitations before starting.

## Workflow

### 1. Load existing events (deduplication baseline)

Read each community file listed in `references/sources.md`. Collect all existing `url`
values into a Set — this is your dedup key. Do this **before** fetching any pages.

### 2. Fetch & parse each source page

For each source in `references/sources.md`:

a. Call `read_url_content` on the community page URL.  
b. If the result contains **chunks**, call `view_content_chunk` on the chunk that mentions
   "Upcoming events" and "Past events" (usually position 1 or 2).  
c. If no chunks (raw HTML dump with no event listings) → mark as **unparsable** and follow
   the unparsable protocol below.  
d. Extract all event entries: title, date, event type label, and detail URL.

### 3. Identify new events

For each event URL extracted: if it is **not** in your dedup Set → it is new.

### 4. Fetch detail pages for new events

For each new event, call `read_url_content` on its detail URL, then `view_content_chunk`
on the "About this event" chunk and the "When + Where" chunk.

Extract:
- `title` — exact event title from the page heading
- `date` — human-readable (e.g. `"14 Jun 2025"`, `"17–18 Jan 2026"`)
- `year` — 4-digit string matching the date
- `type` — map from the GDG label using `references/type-mapping.md`
- `status` — `"upcoming"` if the event is in the future (compare to today's date); `"live"` only if the event is currently in progress; omit for past events
- `location` — venue + city if in-person; omit for virtual
- `theme` — only if explicitly stated as a theme/tagline
- `description` — 1–2 sentence summary written from the About section (not copy-pasted verbatim)
- `url` — the canonical detail page URL

### 5. Append to the community file

Open the matching `.ts` file. Append new event objects **at the top of the array** (newest
first). Follow the existing code style exactly — no trailing commas on the last property,
same indentation, same quote style.

### 6. Report

After processing all sources, report:
- ✅ New events added (title, date, community file)
- ⏭ Events skipped (already exist)
- ⚠️ Sources that were unparsable or partially parsable

---

## Unparsable page protocol

A page is **unparsable** if:
- The fetch returns only navigation links and no event titles/dates (SPA not rendered server-side)
- All chunks contain only boilerplate (contact, footer, quick links) with no event data

**When a source is unparsable:**
1. Log: `⚠️ [Community name] — page not parsable (reason). Manual check required.`
2. Tell the user the source URL to visit manually.
3. Remind them to paste the event list here and you will add the events.
4. **Do not** modify any data file for that source.

**Known unparsable sources** (as of May 2026): see `references/sources.md` — TFUG BBSR
(`tfugbbsr.in`) is a client-side SPA and will always be unparsable via fetch.

---

## Rules

- Never edit `src/data/events/index.ts` — it is auto-generated from community files.
- Never edit `src/data/events/types.ts` unless adding a new EventType.
- Dedup strictly by `url`. If a detail URL redirects or changes, treat it as new and note it.
- If a page has a "Load more" button, note that only the initially visible events were captured.
- Do not invent descriptions. If the About section is empty, use the OG description from the fetch result.
- `status` must only be `"upcoming"` or `"live"` — never `"past"`. Omit the field for past events.
