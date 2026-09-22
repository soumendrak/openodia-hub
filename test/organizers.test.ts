import { describe, expect, it } from "vitest";
import {
  ORGANIZERS,
  getOrganizer,
  organizerSearchText,
  resolveOrganizerId,
} from "../src/data/organizers";
import { events } from "../src/data/events";

describe("organizer registry", () => {
  it("uses unique URL-safe identities and official HTTPS destinations", () => {
    expect(new Set(ORGANIZERS.map((organizer) => organizer.id)).size).toBe(ORGANIZERS.length);
    for (const organizer of ORGANIZERS) {
      expect(organizer.id).toMatch(/^[a-z0-9-]+$/);
      expect(organizer.officialUrl).toMatch(/^https:\/\//);
      expect(getOrganizer(organizer.id)).toEqual(organizer);
    }
  });

  it("resolves every checked-in event organizer and exposes canonical search text", () => {
    for (const event of events) {
      expect(resolveOrganizerId(event.community)).toBeTruthy();
      expect(event.organizerId).toBe(resolveOrganizerId(event.community));
    }
    expect(organizerSearchText("GDG Bhubaneswar")).toContain("GDG Bhubaneswar");
    expect(resolveOrganizerId("unknown organizer")).toBeUndefined();
  });
});
