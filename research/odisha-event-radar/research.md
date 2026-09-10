# Odisha AI event radar expansion

Research checked: 10 September 2026

Expand beyond GDG: add university departments, regional colleges, professional communities and applied-AI programmes. Prioritize sources with registration invitations; retain geographic candidates with unknown access in review.

## Current baseline

11 configured sources: GDG Bhubaneswar; GDGoC NIST, KIIT, CVR, IIIT (archive-only), ITER/SOA, VSSUT, NIT Rourkela; Odisha AI; OdiaGenAI (partial); TFUG (manual-only). Daily workflow: 11:30 IST, crawl to review PR. Existing crawler excludes administrative events but has no strict AI-relevance filter. GDG pagination is not covered.

## Recommendations

### GDGoC GIET University — Gunupur (First batch)

New college

AgentCraft (11 Mar 2026), Build With AI (18 Mar 2026), and Solutions Challenge: Build with AI (20 Jun 2026).

Attendance: **Unknown** — Free registration labels exist, but external/non-GIET eligibility was not established for the cited events. Confirm each detail page before promoting as publicly attendable.

[Source](https://gdg.community.dev/gdg-on-campus-giet-university-gunupur-india/)

Proposed maintenance: Existing GDG adapter. Verification: Direct HTTP 200; __NEXT_DATA__ with 4 past events. No upcoming events in initial payload.

Strongest easy addition for southern Odisha. Follow GIET university news separately for faculty programmes.

### GDGoC Birla Global University — Bhubaneswar (First batch)

New college

Introduction to GenAI with Gemini and Langchain, 19 Jan 2026; NextMind 12, 9 Jan 2026. Earlier Build with AI workshop on 5 Apr 2025.

Attendance: **Public invitation** — The Apr 2025 Build with AI page explicitly welcomes students, developers and AI enthusiasts. Later events require their own eligibility check; historical registration is not currently open.

[Source](https://gdg.community.dev/gdg-on-campus-birla-global-university-bhubaneswar-india/)

Proposed maintenance: Existing GDG adapter. Verification: Direct HTTP 200; embedded payload has 4 past events. Includes non-AI JavaScript events: filter required.

Low implementation effort and a new student community.

### GDG Cloud Bhubaneswar — Bhubaneswar (First batch)

Additional community

GPT in the Cloud, 13 Sep 2025. Current payload lists Code for Communities 2.0 on 13 Sep 2026, already represented in the existing radar.

Attendance: **Public invitation** — 13 Sep 2026 Code for Communities 2.0 welcomes anyone interested in AI and exposes Get tickets. Venue remains TBD; external registration, guidebook selection rules and live availability not verified.

[Source](https://gdg.community.dev/gdg-cloud-bhubaneswar/) · [Supporting evidence](https://gdg.community.dev/events/details/google-gdg-cloud-bhubaneswar-presents-gpt-in-the-cloud-crafting-the-future-of-applications/)

Proposed maintenance: Existing GDG adapter. Verification: Direct HTTP 200; 1 upcoming and 4 past payload records. Strong overlap with GDG Bhubaneswar.

Coverage insurance, not five new events. Preserve canonical destination deduplication; older unique events need pagination/backfill.

### IIT Bhubaneswar — Argul / Khordha (First batch)

New college

Advances in Artificial Intelligence workshop, 7 Feb 2026; Technology, Finance & AI conference, 25–26 Feb 2026.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://www.iitbbs.ac.in/index.php/home/events-archives/) · [Supporting evidence](https://www.iitbbs.ac.in/index.php/workshop-on-advances-in-artificial-intelligence-towards-a-democratized-future/)

Proposed maintenance: HTML event lists + detail pages. Verification: Homepage direct HTTP 200 and advertises RSS. Feed content/coverage not tested. Archive has pagination and separate publication dates.

Research workshops and applied AI. Track current events as well as archive; read dates from event details.

### IIIT Bhubaneswar workshops — Bhubaneswar (First batch)

New channel at tracked college

DLAI-10, 7–11 Jul 2026; Recent Trends in AI and Cybersecurity, 26–27 Mar 2026.

Attendance: **Eligibility / fee / cap** — DLAI-10: students, academics and industry professionals; ID proof, fee payment and 60-seat limit; foundational ML/AI knowledge expected. Hybrid. Deadline 29 Jun 2026 has passed. This is a past event.

[Source](https://www.iiit-bh.ac.in/category/workshops/) · [Supporting evidence](https://sites.google.com/iiit-bh.ac.in/dlai-10/home)

Proposed maintenance: HTML / candidate RSS adapter. Verification: Direct HTTP 200; site advertises /feed/. Workshop titles and event dates readable. Feed not validated.

Restores discovery at an institution whose GDG source is currently configured archive-only. Keep the old archive for deduplication.

### NIT Rourkela departments — Rourkela (First batch)

New channel at tracked college

Edge Intelligence, 18–22 May 2026; Problem-Driven AI, 7–16 Feb 2026. Mechanical engineering also lists AI-driven manufacturing in Apr 2026.

Attendance: **Public invitation** — Problem-Driven AI advertised public registration; official brochure specifies free, online, 7–16 Feb 2026. Past event. Other workshops and departmental seminars may restrict attendance.

[Source](https://www.nitrkl.ac.in/CS/ClosedWorkshops/) · [Supporting evidence](https://www.nitrkl.ac.in/ME/ClosedWorkshops/)

Proposed maintenance: HTML lists + linked brochures. Verification: Web extraction exposes titles and date ranges. Follow the page's Upcoming Workshops link; also discover other departments.

High-value research and domain applications missing from GDG. Label online and eligibility-restricted events accurately.

### Fakir Mohan University — Balasore (First batch)

New college

CS notice for Emerging Trends in Artificial Intelligence and Digital System, published 2 Feb 2026; ET-AIML2025 report also listed.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://fmuniversity.nic.in/dept_notice?dept_id=12)

Proposed maintenance: Notice table + linked PDF. Verification: Direct HTTP 200. Table dates are publication/expiry dates, NOT conference dates; brochure verification required.

Adds a northern Odisha hub. Admit the source now; hold individual events until their actual dates are established.

### Ravenshaw University — Cuttack (First batch)

New college

AI & ML: Changing the Paradigm of Technology, 20 Feb 2026; Statistics in the Age of AI, 14 Feb 2026; AI and public health, 20 Mar 2026.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://ravenshawuniversity.ac.in/eventreportdisp.php)

Proposed maintenance: HTML report table. Verification: Search extraction provides dated event rows. Primarily retrospective; not proven to give advance notice.

Adds Cuttack and AI in statistics, education and humanities. Pair with a notices channel for future discovery.

### Odisha State Open University — Sambalpur (First batch)

New college

AI Empowered Office online training, 11–24 Nov 2025; AR/VR, AI and Digital Twin workshop, 6 Nov 2025.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://osou.ac.in/training-programmes-fdp-workshop.html)

Proposed maintenance: HTML training table. Verification: Direct HTTP 200; readable programme/date table. This evidence is from 2025, not proof of a 2026 AI schedule.

Adds western Odisha and practical AI literacy. Online events should count as Odisha-organized, not physically in Sambalpur.

### Bhubaneswar Data + AI — Bhubaneswar (Second batch)

New community

Snowflake Intelligence meetup, 13 Dec 2025; group listing also shows AI Builder and CoCo workshop activity in 2026.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://www.meetup.com/bhubaneswar-data-ai-meetup-group/)

Proposed maintenance: Meetup detail extraction / browser fallback. Verification: Public listing readable through web search; unattended fetch reliability and exact dates of yearless cards not validated.

Adds working data/AI practitioners beyond student GDG events. Resolve full dates from detail pages.

### IEEE Bhubaneswar Computer Society — Bhubaneswar / statewide (Second batch)

New community

The Evolution of AI: From Neural Networks to Foundation Models, 7 Aug 2026.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://r10.ieee.org/bhubaneswar-computer/) · [Supporting evidence](https://r10.ieee.org/bhubaneswar-computer/blog/2026/08/09/07th-aug-2026-the-ieee-computer-society-chapter-bhubaneswar-section-organised-an-expert-talk-on-the-evolution-of-ai-from-neural-networks-to-foundation-models-delivered-by-dr-yajn/)

Proposed maintenance: Agent-assisted public page review. Verification: Indexed event article readable; direct homepage request returned HTTP 403. Automated adapter not ready.

Cross-institution professional network. Verify format and venue on each event; a chapter address does not establish event location.

### Silicon University — Bhubaneswar (Second batch)

New college

AI for Atmanirbhar Bharat talk, 9 Feb 2026; IBM/Nasscom AI workshop on 14 Mar 2026 reported in quarterly newsletter.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://silicon.ac.in/bbsr-home/events/) · [Supporting evidence](https://silicon.ac.in/wp-content/uploads/2026/04/SiliconTech-Newsletter-Jan-Mar-2026.pdf)

Proposed maintenance: HTML events + news + occasional PDF. Verification: Readable event table, news archive and newsletter evidence. Adapter not exercised.

Multiple independent channels; list alone misses smaller workshops. News and newsletter backfill improve recall.

### IIM Sambalpur / AI4Odisha — Sambalpur (Second batch)

New college / initiative

AI for Business Growth: From Local Markets to National Reach workshop reported by PIB on 16 May 2026.

Attendance: **Unknown** — MSMEs and entrepreneurs are the stated audience, but no public registration route was established. Executive programmes for MCL staff are restricted and must be labelled separately.

[Source](https://iimsambalpur.ac.in/) · [Supporting evidence](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2261860&lang=2&reg=48)

Proposed maintenance: Institution notices + PIB discovery. Verification: Primary government report confirms initiative and workshop. A recurring event-list endpoint still needs identification.

Adds AI adoption by MSMEs and entrepreneurs. Separate public workshops from closed executive training.

### Parala Maharaja Engineering College — Berhampur (Second batch)

New college

AIMLCPS-2026 conference, 19–21 Feb 2026; official event page includes exact date range and PMEC location.

Attendance: **Registration advertised** — Official conference page provides registration by email. General attendee versus accepted-author categories, fee and eligibility remain unverified; past event.

[Source](https://pmec.ac.in/event/aimlcps-2-26/) · [Supporting evidence](https://buodisha.edu.in/faculty/narayan-sahoo/)

Proposed maintenance: Event listing + detail / poster extraction. Verification: Official detail is readable; full conference title corroborated by participating faculty's institutional page. Recurring index needs validation.

Adds applied AI in communication and power systems beyond NIST's student events.

### Berhampur University AIU-AADC — Berhampur (Second batch)

New college

Applied AI and ML in Financial Analytics, Market Dynamics and Managerial Decision-Making FDP, 8–13 Sep 2025.

Attendance: **Unknown** — Faculty and scholars are the reported audience; registration route and external eligibility for the cited FDP are unverified.

[Source](https://buodisha.edu.in/aiu-aadc-centre/) · [Supporting evidence](https://buodisha.edu.in/wp-content/uploads/2025/12/September-2025.pdf)

Proposed maintenance: Centre page + newsletter PDFs. Verification: Primary newsletter provides dates. Centre page retains stale tentative/forthcoming wording for past events.

Adds faculty and interdisciplinary AI. Treat report as historical evidence; do not copy stale upcoming labels.

### Central University of Odisha — Koraput / Sunabeda (Watchlist)

New college

Official PDF records a lecture on the future of AI; a 4 Aug 2026 news report covers a three-day journalism/AI seminar.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://cuo.ac.in/Events-images/482.pdf) · [Supporting evidence](https://www.newindianexpress.com/amp/story/states/odisha/2026/Aug/04/cuo-seminar-on-grassroots-journalism-in-era-of-ai)

Proposed maintenance: Discover institutional notices + PDF. Verification: Official PDF indexed but failed direct web open. Recent event currently corroborated only by secondary reporting in this research.

Promising geographic addition; confirm primary announcement and dates before importing the recent event.

### MSCBD University — Baripada (Watchlist)

New college

RTCCA seminar covering IoT, AI and ML, 8–9 Jul 2023, documented by the university brochure.

Attendance: **Unknown** — No explicit public registration and external eligibility were established for the cited example. Keep in discovery/review; do not present as open attendance.

[Source](https://nou.nic.in/National-Seminar-CA-2023.pdf)

Proposed maintenance: Monthly notice discovery. Verification: Historical primary evidence only; recent recurring AI events not established.

Useful Mayurbhanj discovery target, not yet a high-frequency feed.

### Startup Odisha / O-Hub — Bhubaneswar / statewide (Second batch)

Startup ecosystem

AWS Cloud Innovate Odisha at O-Hub includes Bedrock and Nova demonstrations; official Startup Odisha newsletters record AI workshops.

Attendance: **Approval / target audience** — AWS page uses Request to attend and targets startups. December 2024 LinkedIn invitation advertises registration for technology-startup roles. Do not imply guaranteed entry.

[Source](https://startups.aws.com/events/cloud-innovate-odisha-startup-acceleration-day?lang=en-US) · [Supporting evidence](https://www.linkedin.com/posts/startupodisha_register-now-httpsshorturlat4ucw5-activity-7271146092707127296-XHQA)

Proposed maintenance: Organizer announcements + partner pages. Verification: Government website and organizer LinkedIn provide event evidence and advance registration invitations. AWS event has missing full date; hold it until resolved.

Find industry and startup AI outside college calendars. AWS groups with only old generic cloud meetups stay discovery-only.

### SOA / OAIC 2026 — Bhubaneswar (Watchlist)

New channel at tracked college

OAIC 2026 announced for 19–20 Dec 2026. Official website lists full-paper submission deadline 15 Sep 2026. This is separate from the Odisha AI community annual conference.

Attendance: **Unknown** — Upcoming event confirmed; public/non-author attendance, fee, registration opening and seat availability unknown. Do not mark registration open.

[Source](https://www.oaic.in/)

Proposed maintenance: Conference website + organizer announcements. Verification: Official page opened. Registration menu currently returns to the homepage; no general attendee terms established.

Concrete advance-notice lead from LinkedIn, confirmed at organizer site. A call for papers is not proof of public attendee registration.

## Maintenance proposal

### One source registry

Record organization, city/district, listing URLs, adapter, cadence, last successful fetch, last event discovered, health and evidence. Generate crawler configuration and skill documentation from it so they cannot drift.

### Daily collection; weekly discovery

Keep the existing daily crawl-to-PR workflow. Run an agent weekly across new notices, public community pages and search results. Search city aliases: Bhubaneswar/Bhubaneshwar, Berhampur/Brahmapur, Balasore/Baleswar, Burla/Sambalpur, Gunupur, Cuttack, Koraput/Sunabeda and Baripada. Monthly, look for new organizers and districts.

### Require AI evidence and Odisha relevance

Use full-word AI/ML and substantive agenda evidence: GenAI, NLP, LLMs, computer vision, deep learning, RAG, agentic AI or AI applications. Generic cloud, coding, robotics or hackathon labels alone do not qualify. Separate physical Odisha events from online events organized by Odisha institutions and diaspora events. Do not classify by organizer address alone.

### Extract facts with provenance

For every candidate retain discovery URL, canonical detail URL, evidence excerpt, fetched time, event start/end, format, venue, organizer, registration deadline and eligibility. Publication date, expiry date and submission deadline are distinct from event date. Unknown remains unknown; conflicted dates go to review.

### Deduplicate across channels

Reuse eventUrlKey and destination redirects. For different domains, flag matching normalized title + organizer + start date + venue as possible duplicates; preserve aliases and all evidence. Do not auto-merge distinct recurring sessions. A PDF, Meetup entry and university announcement may describe one event.

### Review exceptions in one PR

The agent prepares one weekly review: verified candidates, date conflicts, possible duplicates, stale/blocked feeds and proposed new sources. A successful empty page is different from a parser failure. Re-fetch upcoming events for date, venue or cancellation changes; append-only crawling misses updates.

### Measure whether expansion works

Track unique AI events by district, new organizers, advance-notice lead time, retrospective-only discoveries, source failure age and rejected non-AI candidates. Assess after four weekly runs. More source URLs alone is not proof of wider coverage.

## Rollout and limits

Revised scope: 19 researched source groups plus eight supplemental government/social channel groups, with overlapping organizers. Prioritize explicit attendance evidence rather than original batch labels. Three GDG sources expose the existing payload format; institutional adapters and social collection require implementation. These are source groups, not counts of unique organizations or working adapters. Historical evidence does not establish upcoming events or public eligibility. No production event data or crawler code was changed.

The search is not exhaustive; weak recent evidence in a district means a discovery gap, not absence of AI activity. Direct fetch checks were one-time probes, not scheduled reliability tests. Advertised RSS endpoints were not validated.

## Government and social announcement channels

### Startup Odisha / O-Hub

An advance registration invitation for the 11 Dec 2024 GenAI workshop identifies developers, data scientists, engineering managers and CTOs at technology startups. Government website also records Hack the Future on 1–2 Dec 2025.

Attendance: Audience-targeted registration; startup roles specified. The separate AWS Cloud Innovate event says Request to attend: application/approval required, not guaranteed admission.

High priority. Check website and LinkedIn announcements daily; use event reports for backfill. Both social accounts linked by government website. X timeline returned 403; continuous social collection not proven.

[Link](https://startupodisha.gov.in/) · [Link](https://www.linkedin.com/company/startupodisha/) · [Link](https://x.com/startup_odisha) · [Link](https://www.linkedin.com/posts/startupodisha_register-now-httpsshorturlat4ucw5-activity-7271146092707127296-XHQA)

### E&IT Department / OCAC / Odisha AI Mission

PIB curtain raiser on 17 Dec 2025 announced the Regional AI Impact Conference for 18–20 Dec. OCAC directly embeds the EIT_Odisha timeline.

Attendance: Public registration unknown. Working-group stakeholder meetings must not be presented as open attendance without an invitation or explicit registration policy.

High-value government discovery. Check official notices and announcements; reject AI procurement tenders and pre-bid meetings as event noise. Direct OCAC HTML worked; X returned 403; AI Mission fetch hit certificate validation trouble.

[Link](https://ocac.in/) · [Link](https://x.com/EIT_Odisha) · [Link](https://aimission.odisha.gov.in/) · [Link](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2205412&lang=2&reg=48)

### PIB Bhubaneswar / MeitY / Ministry of Education

Advance government announcement of the regional AI conference; also reports AI4Odisha at IIM Sambalpur in May 2026.

Attendance: Announcement is evidence of an event, not eligibility. Registration policy must come from organizer or registration page.

Daily search by Bhubaneswar/Odisha plus AI terms. Capture published time separately from event time. A one-day curtain raiser is useful but not a reliable long lead-time source.

[Link](https://www.pib.gov.in/) · [Link](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2205412&lang=2&reg=48)

### STPI Bhubaneswar

Government centre confirmed. Local site links national STPI accounts. Brochure lists an AI/ML course in Bhubaneswar, but a recent dated public local AI workshop was not established in this research.

Attendance: Discovery only; eligibility and public registration unknown. Distinguish courses, incubatee-only sessions and competitive startup calls from open events.

Weekly watch of local announcements and national posts filtered by Odisha venue. Official social links confirmed in local HTML; X returned 403. Do not ingest national events merely because STPI has an Odisha office.

[Link](https://bhubaneswar.stpi.in/) · [Link](https://x.com/stpiindia) · [Link](https://www.linkedin.com/company/stpiofficial) · [Link](https://stpi.in/index.php/en/bhubaneswar)

### Odia Generative AI — additional social channel

Organizer posted an advance invitation with workshop and registration links for its three-day workshop. This supplements the already-tracked website.

Attendance: Public registration advertised historically; follow the linked form for edition-specific fees, eligibility and deadlines. Not a claim that registration is currently open.

High priority LinkedIn discovery: event announcements and speaker posts often precede complete website updates. Indexed organizer post confirmed; account's full timeline coverage not tested.

[Link](https://www.odiagenai.org/) · [Link](https://www.linkedin.com/company/odia-generative-ai/) · [Link](https://www.linkedin.com/posts/odia-generative-ai_we-are-delighted-to-announce-that-prof-amit-activity-7329978511803281409-nEtx)

### Odisha AI — additional social channel

Organizer posted a registration invitation for the 2024 conference. Useful registration-layer supplement to existing conference discovery.

Attendance: Historical registration invitation; verify current edition separately. Online/diaspora activity must be distinct from physically attending in Odisha.

Check official event posts and linked registration page, retaining short-link destination and edition. Full timeline not tested.

[Link](https://www.odishaai.org/) · [Link](https://www.linkedin.com/company/odisha-ai/) · [Link](https://www.linkedin.com/posts/odisha-ai_register-at-httpsbitlyoai2024-to-listen-activity-7246835467336192000-J7sU)

### NIT Rourkela — additional LinkedIn channel

Institution advertised the 7–16 Feb 2026 online Problem-Driven AI workshop with a registration link. Its official brochure says no registration fee.

Attendance: Public registration advertised historically, free and online; explicit eligibility and current form availability still require checking. Other NIT events can have different criteria.

High priority registration discovery paired with departmental listings. The indexed institutional post was read; school-profile endpoint and continuous timeline access not separately validated.

[Link](https://www.nitrkl.ac.in/) · [Link](https://www.linkedin.com/school/national-institute-of-technology-rourkela/) · [Link](https://www.linkedin.com/posts/national-institute-of-technology-rourkela_artificialintelligence-deeplearning-nitrourkela-activity-7425129127440965632-ZN0Q)

### OKCL — restricted-event example

AI Capacity Building Workshop at Power Training Centre, Bhubaneswar on 10 Jul 2026 was for OPTCL officials.

Attendance: Restricted: OPTCL officials / organizational training. No public registration evidenced. Exclude from the attendable public feed; retain only if showing restricted ecosystem activity.

Low priority for public discovery. Organizer post is readable; profile URL and full timeline not separately validated. Do not label all OKCL events private based on this example.

[Link](https://www.linkedin.com/company/official-okcl/) · [Link](https://www.linkedin.com/posts/official-okcl_okcl-ai-artificialintelligence-activity-7482704767631343616-QZIs)

## Revised attendance-first rollout

1. Add attendance policy (public, eligible audience, approval-required, members/campus-only, private/invite-only, unknown) independently of registration status (not yet open, open, closed, sold out, waitlist, unknown). Store fee, deadline, capacity, prerequisite/ID/nomination rules and evidence. Public registration is not necessarily free or guaranteed admission.
2. Start with registration-invitation sources: GDG Cloud, Birla, IIIT DLAI, NIT workshop announcements, Startup Odisha and OdiaGenAI social posts. Historical public invitations do not establish current open registration. GIET has compatible payloads but external attendance remains unverified.
3. Daily website and accessible social checks; weekly statewide discovery; monthly new-source search. Link social posts to canonical detail and registration URLs. Keep original announcement timestamp. Never silently replace blocked social coverage with “no events”. No continuous monitoring, subscriptions or alerts were configured in this research.
4. Broaden regional discovery through FMU, Ravenshaw, OSOU, PMEC and others. Unknown attendance remains in review. Restricted events must carry their actual criteria. Exclude tenders/pre-bid conferences, evergreen self-paced courses and events outside Odisha from the in-person Odisha feed.
5. Upcoming lead: SOA OAIC, 19–20 Dec 2026, paper submission deadline 15 Sep 2026. Non-author public registration not confirmed; homepage registration link loops back. Distinct from Odisha AI community conference.
6. Before implementation, write plan.md/tasks and verify the required repository checks after code changes. Current output is research only.
