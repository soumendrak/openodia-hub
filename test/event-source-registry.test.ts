import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCES } from "../scripts/crawl-events.mjs";
import { events } from "../src/data/events";
import { eventUrlKey } from "../src/lib/event-url";
import { getOrganizerById } from "../src/data/organizers";

// Guards the three places an agent must touch when adding a source, so a
// half-wired source fails CI instead of silently never rendering or crawling.
const root = process.cwd();
const dataDir = join(root, "src/data/events");
const index = readFileSync(join(dataDir, "index.ts"), "utf8");
const registry = readFileSync(
  join(root, ".agents/skills/crawl-events/references/sources.md"),
  "utf8",
);
const dataFiles = readdirSync(dataDir).filter(
  (file) => file.endsWith(".ts") && file !== "index.ts" && file !== "types.ts",
);

describe("event source registry", () => {
  it.each(dataFiles)("%s is imported by index.ts and listed in sources.md", (file) => {
    expect(index).toContain(`from "./${file.slice(0, -3)}"`);
    expect(registry).toContain(`src/data/events/${file}`);
  });

  // Events sharing a URL collapse into one card, so an agent reusing a listing
  // page URL for several events would silently lose all but one.
  it("gives every event its own destination URL", () => {
    // ponytail: legacy TFUG entries predate this rule and all use the SPA listing URL.
    const keys = events
      .filter((event) => event.community !== "TFUG Bhubaneswar")
      .map((event) => eventUrlKey(event.url));
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  it.each(SOURCES.map((source) => [source.id, source] as const))(
    "crawler source %s has a data file and a sources.md row",
    (_, source) => {
      expect(registry).toContain(source.url);
      if (source.file) expect(existsSync(join(dataDir, source.file))).toBe(true);
      const organizer = getOrganizerById(source.id);
      expect(organizer).toBeDefined();
      expect(organizer?.officialLinks.map((link) => link.url)).toContain(source.url);
      expect("archiveOnly" in source).toBe(organizer?.collectionMode === "archive-only");
      expect("partial" in source).toBe(organizer?.collectionMode === "partial");
    },
  );
});
