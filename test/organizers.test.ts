import { describe, expect, it } from "vitest";
import { events } from "../src/data/events";
import {
  COLLECTION_MODES,
  ORGANIZERS,
  findUnresolvedOrganizerNames,
  getOrganizerById,
  resolveOrganizer,
  resolveOrganizerId,
  resolveOrganizerName,
  validateOrganizerRegistry,
  type Organizer,
} from "../src/data/organizers";

const validOrganizer: Organizer = {
  id: "example-group",
  canonicalName: "Example Group",
  aliases: ["Example legacy name"],
  description: "A test organizer.",
  region: "Odisha",
  kind: "community",
  collectionMode: "manual",
  officialLinks: [
    {
      label: "Official website",
      url: "https://example.com/",
      evidenceUrl: "https://example.com/about",
      verificationNote: "The about page identifies the organizer.",
      verifiedOn: null,
    },
  ],
};

describe("organizer identity registry", () => {
  it("is internally valid and keeps every collection mode distinct", () => {
    expect(validateOrganizerRegistry(ORGANIZERS)).toEqual([]);
    expect(new Set(ORGANIZERS.map((organizer) => organizer.collectionMode))).toEqual(
      new Set(COLLECTION_MODES),
    );
  });

  it("resolves IDs, canonical names, legacy aliases, and normalized whitespace", () => {
    expect(getOrganizerById("odishaai").canonicalName).toBe("Odisha AI");
    expect(getOrganizerById("not-published")).toBeUndefined();
    expect(resolveOrganizer("  gdg ON campus   kiit ")?.id).toBe("gdgoc-kiit");
    expect(resolveOrganizerId("OSOU")).toBe("osou");
    expect(resolveOrganizerName("startup-odisha")).toBe("Startup Odisha");
    expect(resolveOrganizerId("unknown group")).toBeUndefined();
    expect(resolveOrganizerName("unknown group")).toBeUndefined();
  });

  it("reports unique unresolved names without inventing fallback metadata", () => {
    expect(
      findUnresolvedOrganizerNames(["Odisha AI", "Unknown B", "Unknown A", "Unknown B"]),
    ).toEqual(["Unknown A", "Unknown B"]);
  });

  it("gives every checked-in event a resolvable ID while preserving community", () => {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.organizerId).toBeTruthy();
      const organizer = resolveOrganizer(event.community);
      expect(organizer?.id).toBe(event.organizerId);
      expect(organizer?.canonicalName).toBe(event.community);
    }
  });

  it("requires provenance and represents an unknown verification date explicitly", () => {
    for (const organizer of ORGANIZERS) {
      expect(organizer.officialLinks.length).toBeGreaterThan(0);
      for (const link of organizer.officialLinks) {
        expect(link.evidenceUrl).toMatch(/^https:\/\//);
        expect(link.verificationNote.length).toBeGreaterThan(0);
        expect(link.verifiedOn === null || /^\d{4}-\d{2}-\d{2}$/.test(link.verifiedOn)).toBe(true);
      }
    }
  });

  it("detects invalid IDs, duplicate IDs and aliases, unsupported values, links, and dates", () => {
    const invalid = [
      validOrganizer,
      {
        ...validOrganizer,
        id: "Bad ID",
        canonicalName: "Other Group",
        aliases: ["Other Group", "example LEGACY name"],
        kind: "club",
        collectionMode: "broken",
        officialLinks: [
          {
            ...validOrganizer.officialLinks[0],
            url: "http://insecure.example.com",
            evidenceUrl: "http://insecure.example.com/evidence",
            verificationNote: "",
            verifiedOn: "10 September 2026",
          },
        ],
      },
      { ...validOrganizer, canonicalName: "Third Group", aliases: [] },
      {
        ...validOrganizer,
        id: "no-links",
        canonicalName: "No Links",
        aliases: [],
        officialLinks: [],
      },
    ];

    expect(validateOrganizerRegistry(invalid)).toEqual([
      "Organizer ID is not URL-safe: Bad ID",
      "Unsupported organizer kind for Bad ID: club",
      "Unsupported collection mode for Bad ID: broken",
      'Duplicate organizer identity for Bad ID: "Other Group"',
      'Organizer identity "example LEGACY name" is shared by example-group and Bad ID',
      "Malformed official link for Bad ID: http://insecure.example.com",
      "Malformed evidence URL for Bad ID: http://insecure.example.com/evidence",
      "Missing verification note for Bad ID: http://insecure.example.com",
      "Malformed verification date for Bad ID: 10 September 2026",
      "Duplicate organizer ID: example-group",
      "Organizer has no official links: no-links",
    ]);
  });
});
