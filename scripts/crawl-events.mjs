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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "src", "data", "events");
const SOURCES = [
  // gdg.community.dev chapters — all use the same HTML structure
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
  {
    id: "gdgoc-iiit-bbsr",
    url: "https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/",
    file: "gdgoc-iiit-bbsr.ts",
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

function inferType(title = "") {
  const t = title.toLowerCase();
  for (const { words, type } of TYPE_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return type;
  }
  return "Workshop"; // default
}

function parseDate(dateStr) {
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

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OpenOdiaBot/1.0; +https://openodia.org)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return await resp.text();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Build the date shape from an ISO date string, reading the date part directly
// to avoid timezone drift (start_date is UTC "...Z").
function isoToDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, year, mm, dd] = m;
  const day = Number(dd);
  return {
    display: `${day} ${MONTHS[Number(mm) - 1]} ${year}`,
    year,
    iso: `${year}-${mm}-${dd}`,
  };
}

// Extract events from gdg.community.dev — data now lives in the __NEXT_DATA__
// JSON blob (Next.js), not scrapable HTML cards.
function parseGDGEventCards(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return []; // ponytail: page shape changed again → 0 events, surfaced as "No events found"

  let results;
  try {
    const pd = JSON.parse(m[1]).props.pageProps.prerenderData;
    results = [...(pd.upcomingEvents?.results || []), ...(pd.pastEvents?.results || [])];
  } catch {
    return [];
  }

  return results
    .filter((e) => e.title && e.url)
    .map((e) => ({
      title: e.title.replace(/\s+/g, " ").trim(),
      url: e.url,
      dateRaw: e.start_date || null,
      ...(isoToDate(e.start_date) || {}),
      description: (e.description_short || "").replace(/\s+/g, " ").trim() || null,
    }));
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
  return y ? { year: y[0] } : null;
}

async function parseOdishaAIEvents() {
  const events = [];
  try {
    const shell = await fetchText("https://www.odishaai.org/conferences/");
    const bundle = shell.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!bundle) {
      console.error("  ⚠️ Could not locate JS bundle in odishaai.org shell");
      return events;
    }
    const js = await fetchText(`https://www.odishaai.org${bundle[1]}`);

    // Each conference detail object starts `{slug:` and uniquely carries a
    // conference-covers image + a location field. Read fields forward from slug.
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
  } catch (e) {
    console.error(`  ⚠️ Failed to fetch odishaai.org: ${e.message}`);
  }
  return events;
}

// Load existing event URLs from a .ts file
function loadExistingUrls(filePath) {
  if (!existsSync(filePath)) return new Set();
  const content = readFileSync(filePath, "utf-8");
  const urls = [...content.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  return new Set(urls);
}

// Check if a title already exists (fuzzy match)
function titleExists(title, content) {
  const normalized = title.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return content.toLowerCase().includes(normalized.slice(0, 40));
}

// Format a new event entry as TypeScript
function formatEventEntry(event) {
  const lines = ["  {"];
  if (event.year) lines.push(`    year: "${event.year}",`);
  if (event.display) lines.push(`    date: "${event.display}",`);
  lines.push(`    title: "${event.title.replace(/"/g, '\\"')}",`);
  lines.push(`    url: "${event.url}",`);
  const eventType = inferType(event.title);
  lines.push(`    type: "${eventType}",`);
  if (event.iso) {
    lines.push(`    startDate: "${event.iso}",`);
    lines.push(`    endDate: "${event.iso}",`);
  }
  if (event.description) {
    lines.push(`    description: "${event.description.replace(/"/g, '\\"').replace(/\n/g, " ")}",`);
  }
  lines.push("  },");
  return lines.join("\n");
}

async function main() {
  let totalNew = 0;

  for (const source of SOURCES) {
    if (source.unparsable) {
      console.log(`⏭  ${source.id} — SPA, not parsable (manual only)`);
      continue;
    }
    if (!source.file) {
      console.log(`⏭  ${source.id} — no data file configured`);
      continue;
    }

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
        const html = await fetchText(source.url);
        events = parseGDGEventCards(html);
      }
    } catch (e) {
      console.error(`  ❌ Failed: ${e.message}`);
      continue;
    }

    if (events.length === 0) {
      console.log(`  - No events found on page`);
      continue;
    }

    console.log(`  - Found ${events.length} events on page`);

    // Load existing events
    const existingUrls = loadExistingUrls(filePath);
    const existingContent = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";

    // Find new events
    const newEvents = events.filter((e) => {
      if (existingUrls.has(e.url)) return false;
      if (titleExists(e.title, existingContent)) return false;
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
      const d = evt.display || evt.dateRaw || "date unknown";
      console.log(`    → ${d}  ${evt.title}`);
    }

    totalNew += newEvents.length;
  }

  console.log(`\n${"=".repeat(40)}`);
  if (totalNew > 0) {
    console.log(`✅ ${totalNew} new event(s) added across all sources`);
    console.log("NEW_EVENTS_FOUND");
  } else {
    console.log("✓ No new events found anywhere");
  }
  console.log(`${"=".repeat(40)}`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
