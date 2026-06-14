#!/usr/bin/env bun
/**
 * crawl-events.mjs — Deterministic event crawler for Odia AI community pages.
 *
 * Runs in GitHub Actions (see .github/workflows/crawl-events.yml).
 *
 * Strategy:
 *   - gdg.community.dev: fetch chapter page, parse event cards from HTML
 *   - odishaai.org: fetch /conferences/, follow year links, parse event details
 *   - Unparsable sources (SPA): log and skip (manual-only)
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

// Extract event cards from gdg.community.dev HTML
function parseGDGEventCards(html) {
  const events = [];
  // Match event card blocks — look for anchor tags with event detail URLs
  const urlPattern = /https:\/\/gdg\.community\.dev\/events\/details\/[^"'\s]+/g;
  const urls = [...new Set(html.match(urlPattern) || [])];

  for (const url of urls) {
    // Find the surrounding card context
    const idx = html.indexOf(url);
    if (idx < 0) continue;

    // Look backwards for a heading/name
    const before = html.slice(Math.max(0, idx - 2000), idx);

    // Extract title — usually in an h3 or strong tag near the URL
    const titleMatch = before.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract date
    const dateMatch = before.match(
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    );
    const dateRaw = dateMatch ? dateMatch[1] : null;

    // Extract event type label
    const typeMatch =
      html.slice(idx, idx + 500).match(/event-type[^>]*>([^<]+)</i) ||
      before.match(/label[^>]*>([^<]+)</i);

    if (title) {
      const parsed = parseDate(dateRaw);
      events.push({
        title: title.replace(/\s+/g, " ").trim(),
        url,
        dateRaw,
        ...(parsed || {}),
        typeLabel: typeMatch ? typeMatch[1].trim() : null,
      });
    }
  }

  return events;
}

// Extract event listing from odishaai.org /conferences/ page
async function parseOdishaAIEvents() {
  const events = [];
  try {
    const html = await fetchText("https://www.odishaai.org/conferences/");
    // Find year links
    const yearLinks = [...html.matchAll(/href=["'](\/conferences\/\d{4}\/)["']/g)];
    for (const [, path] of yearLinks) {
      try {
        const yearHtml = await fetchText(`https://www.odishaai.org${path}`);
        // Extract conference details
        const confMatch = yearHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const dateMatch = yearHtml.match(
          /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        );
        const descMatch = yearHtml.match(/<p[^>]*>([^<]+)<\/p>/i);

        if (confMatch) {
          events.push({
            title: confMatch[1].trim(),
            url: `https://www.odishaai.org${path}`,
            dateRaw: dateMatch ? dateMatch[1] : null,
            description: descMatch ? descMatch[1].trim() : null,
          });
        }
      } catch (e) {
        console.error(`  ⚠️ Failed to fetch ${path}: ${e.message}`);
      }
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
    // Insert after the opening array line, before the first existing entry
    const insertPoint =
      existingContent.indexOf("export const") >= 0
        ? existingContent.indexOf("[") + 1
        : existingContent.lastIndexOf("]");

    if (insertPoint > 0 && insertPoint < existingContent.length - 1) {
      const before = existingContent.slice(0, insertPoint).trimEnd();
      const after = existingContent.slice(insertPoint);
      // If there are already entries, add a newline before
      const prefix = after.trimStart().startsWith("]") ? "\n" : "\n\n  // auto-crawled\n";
      writeFileSync(filePath, `${before}${prefix}${formatted}\n${after.replace(/^\s*\n/, "")}`);
    } else {
      // Append before the closing ]
      const lastBracket = existingContent.lastIndexOf("]");
      if (lastBracket >= 0) {
        writeFileSync(
          filePath,
          existingContent.slice(0, lastBracket).trimEnd() +
            `\n\n  // auto-crawled\n${formatted}\n` +
            existingContent.slice(lastBracket),
        );
      }
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
