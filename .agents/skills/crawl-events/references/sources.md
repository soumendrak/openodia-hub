# Event Sources

Each row: community name | source URL | data file | parsability | notes

---

## ✅ Fully parsable (structured data embedded in the page)

| Community              | Source URL                                                                                                   | Data file                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| GDG Bhubaneswar        | https://gdg.community.dev/gdg-bhubaneswar/                                                                   | `src/data/events/gdg-bhubaneswar.ts`      |
| GDGoC NIST Berhampur   | https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/        | `src/data/events/gdgoc-nist-berhampur.ts` |
| GDGoC KIIT             | https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/        | `src/data/events/gdgoc-kiit.ts`           |
| GDGoC CVR University   | https://gdg.community.dev/gdg-on-campus-c-v-raman-global-university-bhubaneswar-india/                       | `src/data/events/gdgoc-cvr.ts`            |
| GDGoC IIIT Bhubaneswar | https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/ | `src/data/events/gdgoc-iiit-bbsr.ts`      |
| GDGoC ITER SOA         | https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/         | `src/data/events/gdgoc-iter-soa.ts`       |
| GDGoC VSSUT Burla      | https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/              | `src/data/events/gdgoc-vssut-burla.ts`    |
| GDGoC NIT Rourkela     | https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india                      | `src/data/events/gdgoc-nit-rourkela.ts`   |
| Odisha AI              | https://www.odishaai.org/conferences/                                                                        | `src/data/events/odishaai.ts`             |

**gdg.community.dev**: Next.js site. Event data lives in the `__NEXT_DATA__` JSON blob
(`props.pageProps.prerenderData.upcomingEvents.results` + `.pastEvents.results`), not scrapable
HTML cards. Each event has `title`, `url`, `cohost_registration_url`, `start_date`, and
`description_short`. Detail pages expose authoritative `start_date`, `end_date`,
`event_timezone`, `venue_name`, and the complete HTML `description`; sanitize the complete
description into a complete-sentence summary when `description_short` ends in an ellipsis.
Store the cohost URL when present — that's what `/api/events` uses, so the Events page dedups
static + live to a single card. Only the initially-rendered events are included (no "Load more"
data); note this in your report.

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

## Adding a new community

1. Create `src/data/events/<slug>.ts` using any existing file as a template.
2. Add an import and entry to `src/data/events/index.ts` `sources` array.
3. Add a row to this file under the appropriate parsability section.
