#!/usr/bin/env bun
/**
 * crawl-events.mjs — Deterministic event crawler for Odia AI community pages.
 *
 * Runs in GitHub Actions (see .github/workflows/crawl-events.yml).
 *
 * Strategy:
 *   - gdg.community.dev: fetch chapter page, parse the __NEXT_DATA__ JSON blob
 *   - odishaai.org (React SPA): read the JS bundle, extract conference objects
 *   - Unparsable sources (SPA, no embedded data): log and skip (manual-only)
 *
 * Output: appends new events to the appropriate .ts data file.
 * Prints "NEW_EVENTS_FOUND" to stdout if any new events were added.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { eventUrlKey, resolveEventDestinationUrl } from "../src/lib/event-url.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "src", "data", "events");
const SOURCES = [
  // gdg.community.dev chapters — all expose events via the same __NEXT_DATA__ JSON
  {
    id: "gdg-bhubaneswar",
    url: "https://gdg.community.dev/gdg-bhubaneswar/",
    file: "gdg-bhubaneswar.ts",
  },
  {
    id: "gdgoc-nist-berhampur",
    url: "https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/",
    file: "gdgoc-nist-berhampur.ts",
  },
  {
    id: "gdgoc-kiit",
    url: "https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/",
    file: "gdgoc-kiit.ts",
  },
  {
    id: "gdgoc-cvr",
    url: "https://gdg.community.dev/gdg-on-campus-c-v-raman-global-university-bhubaneswar-india/",
    file: "gdgoc-cvr.ts",
  },
  // Keep dead sources in the archive scan so their historical destinations
  // still prevent cross-community duplicates, but do not fetch their pages.
  {
    id: "gdgoc-iiit-bbsr",
    url: "https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/",
    file: "gdgoc-iiit-bbsr.ts",
    archiveOnly: true,
  },
  {
    id: "gdgoc-iter-soa",
    url: "https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/",
    file: "gdgoc-iter-soa.ts",
  },
  {
    id: "gdgoc-vssut-burla",
    url: "https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/",
    file: "gdgoc-vssut-burla.ts",
  },
  {
    id: "gdgoc-nit-rourkela",
    url: "https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india",
    file: "gdgoc-nit-rourkela.ts",
  },
  // Other sources
  { id: "odishaai", url: "https://www.odishaai.org/conferences/", file: "odishaai.ts" },
  // OdiaGenAI — Wix-based, JS-rendered (partially parsable, try known workshop URLs)
  { id: "odiagenai", url: "https://www.odiagenai.org/", file: "odiagenai.ts", partial: true },
  // TFUG BBSR — SPA, not parsable
  { id: "tfug-bbsr", url: "https://www.tfugbbsr.in/event", file: null, unparsable: true },
];

const KNOWN_WORKSHOP_URLS = [
  "https://www.odiagenai.org/workshop-2023",
  "https://www.odiagenai.org/workshop-2024",
  "https://www.odiagenai.org/workshop-2025",
  "https://www.odiagenai.org/workshop-2026",
];

// Type mapping from GDG labels
const TYPE_KEYWORDS = [
  { words: ["hackathon", "hack", "ctf", "arena", "forge"], type: "Hackathon" },
  { words: ["bootcamp", "workshop", "study jam", "study group", "hands-on"], type: "Workshop" },
  { words: ["talk", "session", "seminar", "panel", "webinar", "speaker"], type: "Talk" },
  { words: ["fest", "devfest", "conference", "summit", "congregation"], type: "Conference" },
];

// Thrown when a page is fetched successfully but its expected data structure
// is missing/malformed. Distinguishing this from an empty-but-valid result lets
// the crawler exit nonzero (and fail CI) instead of silently going dark.
export class ParseError extends Error {}

export class HttpError extends Error {
  constructor(status, url, configuredSource = false) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.configuredSource = configuredSource;
  }
}

// Network errors, detail/asset fetches, and retryable HTTP responses should not
// make the daily job flaky. A non-retryable client error on a configured source
// means that source moved or became inaccessible and must fail loudly.
export function isTransientFetchFailure(error) {
  if (!(error instanceof HttpError)) return true;
  const retryableStatus =
    error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  return retryableStatus || !error.configuredSource;
}

export function isFatalCrawlFailure(error) {
  return error instanceof ParseError || !isTransientFetchFailure(error);
}

const CONCATENATED_BRANDS = /\bhack(?:forge|fest)\b/i;

// Match ordinary keywords as complete words. Intentional concatenated brands
// such as HackForge/HackFest are handled explicitly above, so prefixes such as
// "forge" in "forgetful" or "hack" in "hackneyed" do not become Hackathons.
function keywordMatches(text, word) {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
}

export function inferType(title = "", description = "") {
  // Match on title first (strong signal), then fall back to the description —
  // e.g. "Build with AI: Code for Communities" only reveals it's a hackathon
  // in its description.
  for (const source of [title, description]) {
    if (CONCATENATED_BRANDS.test(source)) return "Hackathon";
    for (const { words, type } of TYPE_KEYWORDS) {
      if (words.some((w) => keywordMatches(source, w))) return type;
    }
  }
  return "Workshop"; // default
}

// Skip only clearly administrative events per references/type-mapping.md.
// A generic "planning session" can be a substantive product/technical event,
// while an info/orientation session with an explicit technical agenda is kept.
const INTERNAL_ADMIN_PATTERN =
  /\b(?:(?:organizer|organiser|organizing|organising|committee|core team|work team)\s+(?:meeting|planning|session)|(?:meeting|planning|session)\s+(?:for|with)\s+(?:organizers|organisers|the committee|the core team|the work team))\b/i;
const ORIENTATION_PATTERN = /\b(?:orientation|onboarding|info(?:rmation)? session)\b/i;
const TECHNICAL_CONTENT_PATTERN =
  /\b(?:hands-on (?:lab|workshop|coding)|code[- ]along|live (?:coding|demo)|technical (?:deep dive|talk|workshop|session)|(?:build|deploy|train|fine-tune|prototype) (?:an?|the|your) [a-z])/i;

export function shouldSkip(title = "", description = "") {
  const combined = `${title} ${description}`;
  if (INTERNAL_ADMIN_PATTERN.test(combined)) return true;
  if (!ORIENTATION_PATTERN.test(title)) return false;
  return !TECHNICAL_CONTENT_PATTERN.test(description);
}

export function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim().replace(/\s+/g, " ");
  // Try parsing as "DD Mon YYYY" or "Mon DD, YYYY"
  const d = new Date(cleaned);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2020) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return {
      display: `${day} ${month} ${year}`,
      year: String(year),
      iso: `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  return null;
}

async function fetchText(url, { configuredSource = false } = {}) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OpenOdiaBot/1.0; +https://openodia.org)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new HttpError(resp.status, url, configuredSource);
  return await resp.text();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Community default when an event carries no timezone. GDG start_date is UTC
// ("…Z"); slicing it directly misdates evening events (e.g. 2026-08-07T19:00Z
// is Aug 8 in IST), so resolve the calendar date in the event's timezone.
const DEFAULT_TZ = "Asia/Kolkata";

// Resolve an ISO instant to its calendar-date shape in `timeZone`.
export function tzDate(iso, timeZone = DEFAULT_TZ) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // en-CA formats as YYYY-MM-DD; timeZone does the UTC→local conversion.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [year, mm, dd] = ymd.split("-");
  return { year, iso: ymd, display: `${Number(dd)} ${MONTHS[Number(mm) - 1]} ${year}` };
}

// Human display for a (possibly multi-day) event: "8 Aug 2026", "8–9 Aug 2026",
// or "30 Aug – 1 Sep 2026" when it spans months.
export function formatDateRange(start, end) {
  if (!start) return null;
  if (!end || end.iso === start.iso) return start.display;
  const [sy, sm, sd] = start.iso.split("-");
  const [ey, em, ed] = end.iso.split("-");
  if (sy === ey && sm === em) return `${Number(sd)}–${Number(ed)} ${MONTHS[Number(sm) - 1]} ${sy}`;
  return `${start.display} – ${end.display}`;
}

// Extract events from gdg.community.dev — data lives in the __NEXT_DATA__ JSON
// blob (Next.js), not scrapable HTML cards. Throws ParseError if the page was
// fetched but the expected structure is gone (vs returning [] for a valid-but-
// empty chapter), so a silent site change fails CI instead of going dark.
export function parseGDGEventCards(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new ParseError("__NEXT_DATA__ script tag not found");

  let pd;
  try {
    pd = JSON.parse(m[1]).props.pageProps.prerenderData;
  } catch (e) {
    throw new ParseError(`__NEXT_DATA__ JSON/shape invalid: ${e.message}`);
  }
  if (!pd) {
    throw new ParseError("prerenderData missing");
  }
  for (const key of ["upcomingEvents", "pastEvents"]) {
    if (!pd[key] || !Array.isArray(pd[key].results)) {
      throw new ParseError(`prerenderData.${key}.results missing or not an array`);
    }
  }
  const results = [...pd.upcomingEvents.results, ...pd.pastEvents.results];

  return results.map((e, index) => {
    if (
      !e ||
      typeof e.title !== "string" ||
      !e.title.trim() ||
      typeof e.url !== "string" ||
      !e.url.trim() ||
      (e.cohost_registration_url && typeof e.cohost_registration_url !== "string")
    ) {
      throw new ParseError(`event result ${index} missing title/url`);
    }
    return {
      title: e.title.replace(/\s+/g, " ").trim(),
      // Store Bevy's canonical event URL. Cohost registration URLs are aliases
      // and must never become the identity of a separately rendered event.
      url: e.url,
      detailUrl: e.url,
      dateRaw: e.start_date || null,
      ...(tzDate(e.start_date) || {}),
      description: (e.description_short || "").replace(/\s+/g, " ").trim() || null,
    };
  });
}

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

export function htmlToText(html = "") {
  return html
    .replace(/<(?:br|hr)\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => HTML_ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(text, maxSentences = 2) {
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ");
}

export function detailDescription(eventData = {}) {
  const short = (eventData.description_short || "").replace(/\s+/g, " ").trim();
  const full = htmlToText(eventData.description || "");
  if (full && (!short || /(?:\.{3}|…)$/.test(short))) return summarizeText(full);
  return short || full || null;
}

// Enrich a listing event with detail-page data: authoritative end date,
// timezone, an untruncated complete-sentence summary, and venue. Best-effort — a
// detail-fetch failure leaves the listing data intact rather than failing the
// whole run. Mutates and returns the event.
async function enrichFromDetail(event) {
  try {
    const html = await fetchText(event.detailUrl);
    const m = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    const ed = m && JSON.parse(m[1]).props?.pageProps?.eventData;
    if (!ed) return event;

    const tz = ed.event_timezone || DEFAULT_TZ;
    const start = tzDate(ed.start_date, tz);
    const end = tzDate(ed.end_date, tz);
    if (start) {
      event.year = start.year;
      event.iso = start.iso;
      event.endIso = end ? end.iso : start.iso;
      event.display = formatDateRange(start, end);
    }
    // The concise GDG summary can omit the event format. Classify from the
    // authoritative full detail description before shortening it for display.
    const fullDescription = htmlToText(ed.description || "");
    event.type = inferType(event.title, fullDescription || event.description || "");
    const desc = detailDescription(ed);
    if (desc) event.description = desc;
    if (ed.venue_name) event.location = ed.venue_name.replace(/\s+/g, " ").trim();
  } catch (e) {
    console.error(`    ⚠️  detail enrich failed for ${event.detailUrl}: ${e.message}`);
  }
  return event;
}

// odishaai.org is a client-rendered React SPA — conference data is baked into
// the JS bundle, not the HTML. Read the bundle and extract the conference
// objects ({slug, title, date, location, desc}).
function fieldAfter(chunk, key) {
  const m = chunk.match(new RegExp("^.*?" + key + ":`([^`]*)`"));
  return m ? m[1] : null;
}

// Turn "10 Oct 2026" into the full date shape; a bare "2024" yields year only.
function odishaaiDate(date) {
  if (!date) return null;
  if (/[a-z]/i.test(date)) return parseDate(date); // has a month name
  const y = date.match(/\d{4}/);
  // Year-only: still emit a `display` so formatEventEntry writes the required
  // `date` field (no `iso`, so startDate/endDate are correctly omitted).
  return y ? { year: y[0], display: y[0] } : null;
}

async function parseOdishaAIEvents() {
  // fetch errors propagate (transient); structural problems throw ParseError so
  // a silent site change fails CI. odishaai always lists conferences, so an
  // empty extraction means the bundle shape changed, not "no events".
  const shell = await fetchText("https://www.odishaai.org/conferences/", {
    configuredSource: true,
  });
  const bundle = shell.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!bundle) throw new ParseError("JS bundle <script src> not found in shell");
  const js = await fetchText(`https://www.odishaai.org${bundle[1]}`);

  // Each conference detail object starts `{slug:` and uniquely carries a
  // conference-covers image + a location field. Read fields forward from slug.
  const events = [];
  const idxs = [...js.matchAll(/\{slug:`/g)].map((m) => m.index);
  const seen = new Set();
  for (let i = 0; i < idxs.length; i++) {
    const chunk = js.slice(idxs[i], idxs[i + 1] ?? idxs[i] + 900);
    if (!chunk.includes("conference-covers") || !chunk.includes("location:")) continue;
    const slug = fieldAfter(chunk, "slug");
    const title = fieldAfter(chunk, "title");
    if (!slug || !title || seen.has(slug)) continue;
    seen.add(slug);
    const date = fieldAfter(chunk, "date");
    events.push({
      title: title.trim(),
      url: `https://www.odishaai.org/conferences/${slug}/`,
      dateRaw: date,
      ...(odishaaiDate(date) || {}),
      description: (fieldAfter(chunk, "desc") || "").trim() || null,
    });
  }
  if (events.length === 0) throw new ParseError("no conference objects extracted from bundle");
  return events;
}

// Normalize a GDG event URL for dedup: the same event appears with and without
// a trailing `/cohost-…` segment (e.g. `.../hackforge-20/` vs
// `.../hackforge-20/cohost-gdg-bhubaneswar`). Strip that and any trailing slash.
export const normalizeUrl = eventUrlKey;

/** Follow a GDG event redirect to the destination address used for dedup. */
export async function resolveDestinationUrl(url, fetcher = fetch) {
  return resolveEventDestinationUrl(url, fetcher);
}

async function refreshExistingDestinations(filePath) {
  if (!existsSync(filePath)) return { urls: new Set(), updated: 0 };

  const content = readFileSync(filePath, "utf-8");
  const rawUrls = [...new Set([...content.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => m[1]))];
  const resolved = new Map();
  await Promise.all(
    rawUrls.map(async (url) => resolved.set(url, await resolveDestinationUrl(url))),
  );

  let updated = 0;
  const nextContent = content.replace(
    /(url:\s*["'])([^"']+)(["'])/g,
    (match, prefix, url, suffix) => {
      const destination = resolved.get(url) || url;
      if (normalizeUrl(destination) === normalizeUrl(url)) return match;
      updated += 1;
      console.log(`  🔁 destination updated: ${url} -> ${destination}`);
      return `${prefix}${destination}${suffix}`;
    },
  );

  if (updated > 0) writeFileSync(filePath, nextContent);
  return {
    urls: new Set([...resolved.values()].map(normalizeUrl)),
    updated,
  };
}

// Compare one crawl response against both the existing archive and itself.
// Bevy can repeat an event while a page is being updated (for example in both
// upcomingEvents and pastEvents), so filtering only against the file on disk is
// not enough.
export function filterNewEventsByUrl(events, existingUrls) {
  const seen = new Set(existingUrls);
  return events.filter((event) => {
    const key = normalizeUrl(event.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Format a new event entry as TypeScript
function formatEventEntry(event) {
  const lines = ["  {"];
  if (event.year) lines.push(`    year: "${event.year}",`);
  if (event.display) lines.push(`    date: "${event.display}",`);
  lines.push(`    title: "${event.title.replace(/"/g, '\\"')}",`);
  lines.push(`    url: "${event.url}",`);
  const eventType = event.type || inferType(event.title, event.description || "");
  lines.push(`    type: "${eventType}",`);
  if (event.location) {
    lines.push(`    location: "${event.location.replace(/"/g, '\\"')}",`);
  }
  if (event.iso) {
    lines.push(`    startDate: "${event.iso}",`);
    lines.push(`    endDate: "${event.endIso || event.iso}",`);
  }
  if (event.description) {
    lines.push(`    description: "${event.description.replace(/"/g, '\\"').replace(/\n/g, " ")}",`);
  }
  lines.push("  },");
  return lines.join("\n");
}

export async function main() {
  let totalNew = 0;
  let totalUpdated = 0;
  let fatalFailures = 0;
  // One destination URL is one event across every community, not merely within
  // the community file currently being crawled.
  const existingUrls = new Set();
  for (const source of SOURCES) {
    if (!source.file) continue;
    const refreshed = await refreshExistingDestinations(join(DATA_DIR, source.file));
    totalUpdated += refreshed.updated;
    for (const url of refreshed.urls) existingUrls.add(url);
  }

  for (const source of SOURCES) {
    if (source.unparsable) {
      console.log(`⏭  ${source.id} — SPA, not parsable (manual only)`);
      continue;
    }
    if (source.archiveOnly) {
      console.log(`⏭  ${source.id} — archive only (source unavailable)`);
      continue;
    }
    // Guard kept for future config entries: today the only file-less source
    // (tfug-bbsr) is also `unparsable`, so the check above already caught it.
    /* v8 ignore start */
    if (!source.file) {
      console.log(`⏭  ${source.id} — no data file configured`);
      continue;
    }
    /* v8 ignore stop */

    const filePath = join(DATA_DIR, source.file);
    console.log(`\n🔍 ${source.id} — ${source.url}`);

    let events = [];

    try {
      if (source.id === "odishaai") {
        events = await parseOdishaAIEvents();
      } else if (source.id === "odiagenai") {
        // Try individual workshop URLs
        for (const wurl of KNOWN_WORKSHOP_URLS) {
          try {
            const html = await fetchText(wurl);
            const titleMatch =
              html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
            const dateMatch = html.match(
              /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
            );
            if (titleMatch) {
              events.push({
                title: titleMatch[1].replace(/–.*$/, "").replace(/\s+/g, " ").trim(),
                url: wurl,
                dateRaw: dateMatch ? dateMatch[1] : null,
                description: "Workshop organized by OdiaGenAI community.",
              });
            }
          } catch {
            // skip — page might not exist (pre-2023 or future)
          }
        }
        if (events.length === 0) {
          console.log(
            `  ⚠️  No parsable content found (Wix-based, JS-rendered). Try manual check.`,
          );
          continue;
        }
      } else {
        // GDG community.dev pages
        const html = await fetchText(source.url, { configuredSource: true });
        events = parseGDGEventCards(html);
      }
    } catch (e) {
      // Structural failure (fetched OK, data shape broken) must fail CI; a
      // transient fetch/network error should not turn the daily job red.
      if (e instanceof ParseError) {
        console.error(`  ❌ Parse failed: ${e.message}`);
        fatalFailures++;
      } else if (isFatalCrawlFailure(e)) {
        console.error(`  ❌ Source fetch failed permanently: ${e.message}`);
        fatalFailures++;
      } else {
        console.error(`  ⚠️  Fetch failed (transient): ${e.message}`);
      }
      continue;
    }

    if (events.length === 0) {
      console.log(`  - No events found on page`);
      continue;
    }

    console.log(`  - Found ${events.length} events on page`);

    const existingContent = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";

    // Dedup strictly by destination URL, including repeated records within this
    // response and records already owned by a different community source.
    const candidates = filterNewEventsByUrl(events, existingUrls);

    // Enrich each new GDG event before applying the content-aware admin filter
    // and formatting it (end date, timezone, full description, venue).
    if (source.id !== "odishaai" && source.id !== "odiagenai") {
      for (const e of candidates) await enrichFromDetail(e);
    }

    const newEvents = candidates.filter((e) => {
      if (shouldSkip(e.title, e.description || "")) {
        console.log(`  ⏭  skipped (orientation/admin): ${e.title}`);
        return false;
      }
      return true;
    });

    if (newEvents.length === 0) {
      console.log(`  ✓ No new events`);
      continue;
    }

    console.log(`  🆕 ${newEvents.length} new event(s) found`);

    // Insert new events into the file
    if (!existsSync(filePath)) {
      console.error(`  ❌ Data file ${source.file} not found — can't append`);
      continue;
    }

    const formatted = newEvents.map(formatEventEntry).join("\n");
    // Insert at the top of the array literal (newest-first). Anchor on the
    // array-opening `= [`, NOT the first `[` (that one's in the `Omit<…>[]` type).
    const arrayOpen = existingContent.match(/=\s*\[/);
    const insertPoint = arrayOpen ? arrayOpen.index + arrayOpen[0].length : -1;

    if (insertPoint > 0) {
      const before = existingContent.slice(0, insertPoint);
      const after = existingContent.slice(insertPoint).replace(/^\s*\n/, "");
      // Empty array (`= []`) → no leading blank line before the closing `]`.
      const isEmpty = after.trimStart().startsWith("]");
      const block = isEmpty ? `\n${formatted}\n` : `\n  // auto-crawled\n${formatted}\n`;
      writeFileSync(filePath, `${before}${block}${after}`);
    } else {
      console.error(`  ❌ Could not locate array literal in ${source.file} — skipped`);
      continue;
    }

    for (const evt of newEvents) {
      existingUrls.add(normalizeUrl(evt.url));
      const d = evt.display || evt.dateRaw || "date unknown";
      console.log(`    → ${d}  ${evt.title}`);
    }

    totalNew += newEvents.length;
  }

  console.log(`\n${"=".repeat(40)}`);
  if (totalNew > 0 || totalUpdated > 0) {
    console.log(
      `✅ ${totalNew} new event(s) added; ${totalUpdated} redirected destination(s) updated`,
    );
    console.log("NEW_EVENTS_FOUND");
  } else {
    console.log("✓ No new events found anywhere");
  }
  if (fatalFailures > 0) {
    console.error(`❌ ${fatalFailures} source(s) failed permanently — check source configuration`);
  }
  console.log(`${"=".repeat(40)}`);
  // Nonzero exit on structural parse failure so CI goes red instead of silently
  // running an empty crawl forever.
  return fatalFailures > 0 ? 1 : 0;
}

// Only run when executed directly (`bun scripts/crawl-events.mjs`), not when
// imported by the test suite.
if (process.argv[1]?.endsWith("crawl-events.mjs")) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error("FATAL:", e.message);
      process.exit(1);
    });
}
