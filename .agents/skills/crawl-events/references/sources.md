# Event Sources

Each row: community name | source URL | data file | parsability | notes

---

## ✅ Fully parsable (server-rendered HTML with chunks)

| Community              | Source URL                                                                                                   | Data file                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| GDG Bhubaneswar        | https://gdg.community.dev/gdg-bhubaneswar/                                                                   | `src/data/events/gdg-bhubaneswar.ts`                         |
| GDGoC NIST Berhampur   | https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/        | `src/data/events/gdgoc-nist-berhampur.ts`                    |
| GDGoC KIIT             | https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/        | `src/data/events/gdgoc-kiit.ts`                              |
| GDGoC CVR University   | https://gdg.community.dev/gdg-on-campus-c-v-raman-global-university-bhubaneswar-india/                       | `src/data/events/gdgoc-cvr.ts`                               |
| GDGoC IIIT Bhubaneswar | https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/ | `src/data/events/gdgoc-iiit-bbsr.ts`                         |
| GDGoC ITER SOA         | https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/         | `src/data/events/gdgoc-iter-soa.ts`                          |
| GDGoC VSSUT Burla      | https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/              | `src/data/events/gdgoc-vssut-burla.ts`                         |
| GDGoC NIT Rourkela     | https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india                      | `src/data/events/gdgoc-nit-rourkela.ts`                       |
| Odisha AI              | https://www.odishaai.org/conferences/                                                                        | `src/data/events/odishaai.ts`                                |

**gdg.community.dev pagination**: Each chapter page shows a limited list with a "Load more"
button. The fetch only captures the initially visible events. Note this in your report.

**odishaai.org**: Static Zola site. The `/conferences/` index page links to individual
conference pages. Fetch the index, extract year links, then fetch each year page for details.

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
