# Event Sources

Each row: community name | source URL | data file | parsability | notes

---

## ✅ Fully parsable (structured data embedded in the page)

| Community                     | Source URL                                                                                            | Data file                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| GDG Bhubaneswar               | https://gdg.community.dev/gdg-bhubaneswar/                                                            | `src/data/events/gdg-bhubaneswar.ts`       |
| GDGoC NIST Berhampur          | https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/ | `src/data/events/gdgoc-nist-berhampur.ts`  |
| GDGoC KIIT                    | https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/ | `src/data/events/gdgoc-kiit.ts`            |
| GDGoC CVR University          | https://gdg.community.dev/gdg-on-campus-c-v-raman-global-university-bhubaneswar-india/                | `src/data/events/gdgoc-cvr.ts`             |
| GDGoC ITER SOA                | https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/  | `src/data/events/gdgoc-iter-soa.ts`        |
| GDGoC VSSUT Burla             | https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/       | `src/data/events/gdgoc-vssut-burla.ts`     |
| GDGoC NIT Rourkela            | https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india               | `src/data/events/gdgoc-nit-rourkela.ts`    |
| GDGoC GIET Gunupur            | https://gdg.community.dev/gdg-on-campus-giet-university-gunupur-india/                                | `src/data/events/gdgoc-giet-gunupur.ts`    |
| GDGoC Birla Global University | https://gdg.community.dev/gdg-on-campus-birla-global-university-bhubaneswar-india/                    | `src/data/events/gdgoc-birla-global.ts`    |
| GDG Cloud Bhubaneswar         | https://gdg.community.dev/gdg-cloud-bhubaneswar/                                                      | `src/data/events/gdg-cloud-bhubaneswar.ts` |
| Odisha AI                     | https://www.odishaai.org/conferences/                                                                 | `src/data/events/odishaai.ts`              |

**gdg.community.dev**: Next.js site. Event data lives in the `__NEXT_DATA__` JSON blob
(`props.pageProps.prerenderData.upcomingEvents.results` + `.pastEvents.results`), not scrapable
HTML cards. Each event has `title`, `url`, `cohost_registration_url`, `start_date`, and
`description_short`. Detail pages expose authoritative `start_date`, `end_date`,
`event_timezone`, `venue_name`, and the complete HTML `description`; sanitize the complete
description into a complete-sentence summary when `description_short` ends in an ellipsis.
Store the canonical `url`; `cohost_registration_url` is only a registration alias and must not be
used as event identity. Only the initially-rendered events are included (no "Load more"
data); note this in your report. Before deduplication, the crawler follows redirects for archived
GDG detail URLs and replaces stale addresses with their final `/events/details/` destination. This
handles title/slug edits without creating an old-URL/new-URL pair for one event.

## 📦 Archive only (included in deduplication, not fetched)

| Community              | Source URL                                                                                                   | Data file                            | Reason                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| GDGoC IIIT Bhubaneswar | https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/ | `src/data/events/gdgoc-iiit-bbsr.ts` | Chapter page has returned HTTP 404 since 2026-08-13. Keep its historical URLs in the global scan. |

The IIIT source uses `archiveOnly: true` in `crawl-events.mjs`. Remove that flag if the chapter
returns; do not remove the entry, because every archive participates in destination deduplication.

**odishaai.org**: Client-rendered React SPA — the HTML shell is empty, so there are no year
links to follow. Conference data is baked into the Vite JS bundle. Read the bundle URL from the
shell (`/assets/index-*.js`, hash changes per deploy), fetch it, and extract the conference
objects (`{slug, title, date, location, desc}`), anchoring each on its own `slug:`. Build URLs
as `/conferences/<slug>/`.

---

## ⚠️ Partially parsable (JS-heavy, may return limited data)

| Community | Source URL                 | Data file                      | Limitation                                                                                                                                               |
| --------- | -------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OdiaGenAI | https://www.odiagenai.org/ | `src/data/events/odiagenai.ts` | Wix-based; index navigation is JS-rendered. Try fetching individual known workshop URLs (`/workshop-2023`, `/workshop-2024`, `/workshop-2025`) directly. |

---

## ❌ Not parsable (client-side SPA — no SSR)

| Community | Source URL                    | Data file                      | Action                                                                                                                      |
| --------- | ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| TFUG BBSR | https://www.tfugbbsr.in/event | `src/data/events/tfug-bbsr.ts` | **Manual only.** Ask the user to visit the page and paste the event list. The site is a React SPA with no server-side HTML. |

---

## 🔎 Agent-checked sources (no crawler adapter)

Institutional and government pages with bespoke HTML, PDFs, or publication-date tables. An
agent reviews them on the stated cadence and adds verified events by hand, following the
"Agent-checked sources" rules in `SKILL.md`. Evidence for each row is in
`research/odisha-event-radar/research.md`.

| Community                           | Listing URL(s)                                                                                                                                                    | Data file                                   | Cadence | Watch out for                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| IIT Bhubaneswar                     | https://www.iitbbs.ac.in/index.php/home/events-archives/                                                                                                          | `src/data/events/iit-bhubaneswar.ts`        | Weekly  | Archive is paginated; read dates from detail pages, not publication dates.                                                |
| IIIT Bhubaneswar workshops          | https://www.iiit-bh.ac.in/category/workshops/                                                                                                                     | `src/data/events/iiit-bhubaneswar.ts`       | Weekly  | Workshop sites (e.g. DLAI) carry fee, ID, seat-cap rules → `eligibility`.                                                 |
| NIT Rourkela departments            | https://www.nitrkl.ac.in/CS/ClosedWorkshops/ · https://www.nitrkl.ac.in/ME/ClosedWorkshops/ (follow each page's Upcoming Workshops link; check other departments) | `src/data/events/nit-rourkela.ts`           | Weekly  | Brochures state online/free/eligibility; departmental seminars may be internal.                                           |
| Fakir Mohan University              | https://fmuniversity.nic.in/dept_notice?dept_id=12                                                                                                                | `src/data/events/fakir-mohan-university.ts` | Weekly  | Table dates are publication/expiry dates, **not** event dates — open the PDF.                                             |
| Ravenshaw University                | https://ravenshawuniversity.ac.in/eventreportdisp.php                                                                                                             | `src/data/events/ravenshaw-university.ts`   | Weekly  | One table, no per-event URLs: only one event can use the listing URL — find a report/notice URL for others.               |
| Odisha State Open University        | https://osou.ac.in/training-programmes-fdp-workshop.html                                                                                                          | `src/data/events/osou.ts`                   | Weekly  | One table, no per-event URLs (same one-URL limit). Many programmes are online → `Online`. TLS cert errors: use `curl -k`. |
| Parala Maharaja Engineering College | https://pmec.ac.in/event/aimlcps-2-26/                                                                                                                            | `src/data/events/pmec-berhampur.ts`         | Weekly  | Conference registration may be author-only; check attendee terms.                                                         |
| SOA / OAIC                          | https://www.oaic.in/                                                                                                                                              | `src/data/events/soa-oaic.ts`               | Weekly  | Call for papers ≠ attendee registration. Distinct from the Odisha AI community conference.                                |
| Startup Odisha / O-Hub              | https://startupodisha.gov.in/events/ (detail pages under `/latest_events/`) · https://startups.aws.com/events/cloud-innovate-odisha-startup-acceleration-day      | `src/data/events/startup-odisha.ts`         | Daily   | Audience-targeted (startups) → `eligibility`; "Request to attend" → `approval`. TLS cert errors: use `curl -k`.           |
| Odisha E&IT / OCAC                  | https://ocac.in/ · https://aimission.odisha.gov.in/                                                                                                               | `src/data/events/odisha-eit.ts`             | Daily   | Reject AI tenders, pre-bid meetings, and working-group stakeholder meetings.                                              |

Second-batch / watchlist (discover weekly; create a data file only when the first event is
verified): Bhubaneswar Data + AI (https://www.meetup.com/bhubaneswar-data-ai-meetup-group/),
IEEE Bhubaneswar Computer Society (https://r10.ieee.org/bhubaneswar-computer/ — homepage returns
403 to scripts), Silicon University (https://silicon.ac.in/bbsr-home/events/), IIM Sambalpur /
AI4Odisha (https://iimsambalpur.ac.in/), Berhampur University AIU-AADC
(https://buodisha.edu.in/aiu-aadc-centre/), Central University of Odisha (https://cuo.ac.in/),
MSCBD University (https://nou.nic.in/).

## 📣 Announcement channels (discovery only — never a data file)

These announce events hosted elsewhere. Follow each post to the organizer's detail or
registration page and add the event to that organizer's file. Keep the post URL as evidence.

| Channel          | URLs                                                                                                   | Cadence | Notes                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------ |
| Startup Odisha   | https://www.linkedin.com/company/startupodisha/ · https://x.com/startup_odisha                         | Daily   | Advance registration invitations for startup workshops.            |
| OdiaGenAI        | https://www.linkedin.com/company/odia-generative-ai/                                                   | Daily   | Workshop and speaker posts precede website updates.                |
| Odisha AI        | https://www.linkedin.com/company/odisha-ai/                                                            | Daily   | Resolve short links (bit.ly) to the edition's registration page.   |
| NIT Rourkela     | https://www.linkedin.com/school/national-institute-of-technology-rourkela/                             | Daily   | Workshop registration links; pair with departmental listings.      |
| E&IT Odisha      | https://x.com/EIT_Odisha (embedded on https://ocac.in/)                                                | Daily   | Government conference announcements.                               |
| PIB              | https://www.pib.gov.in/ — search "Bhubaneswar" / "Odisha" + AI                                         | Daily   | Publication time ≠ event time; curtain raisers give ~1 day notice. |
| STPI Bhubaneswar | https://bhubaneswar.stpi.in/ · https://www.linkedin.com/company/stpiofficial · https://x.com/stpiindia | Weekly  | National accounts: only ingest events held in Odisha.              |
| OKCL             | https://www.linkedin.com/company/official-okcl/                                                        | Weekly  | Many sessions are for government officials → `restricted`, skip.   |

X timelines returned HTTP 403 to scripts; LinkedIn needs a signed-in browser. If a channel is
unreachable, report it as **blocked** — never as "no events".

## Weekly statewide discovery

Search the web for AI workshops/conferences/hackathons in the last and next 60 days with each
city alias: Bhubaneswar/Bhubaneshwar, Cuttack, Rourkela, Berhampur/Brahmapur, Balasore/Baleswar,
Burla/Sambalpur, Gunupur, Koraput/Sunabeda, Baripada. Monthly, look for new organizers and
propose them in the PR description before adding them here.

---

## Adding a new community

1. Follow `docs/organizers.md`: a maintainer must confirm the identity and official destination,
   then add it to `src/data/organizers.ts`. A research candidate is not automatically publishable.
2. Create `src/data/events/<slug>.ts` using any existing file as a template.
3. Add an import and organizer-ID entry to `src/data/events/index.ts` `sources` array.
4. Add a row to this file under the appropriate section, including the data-file path.
5. For a gdg.community.dev chapter, add only its adapter details to `SOURCES` in
   `scripts/crawl-events.mjs`; identity and official URLs come from the organizer registry.

`test/event-source-registry.test.ts` fails if the registry, data-file, documentation, or adapter
wiring is missed.
