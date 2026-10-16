import { describe, expect, it } from "vitest";
import { events } from "../src/data/events";
import { getOrganizerById, resolveOrganizerId } from "../src/data/organizers";

describe("Odia language community organizers", () => {
  it("resolves IOSR and the Odia Wikimedians User Group by name and alias", () => {
    expect(resolveOrganizerId("Institute of Odia Studies and Research")).toBe("iosr");
    expect(resolveOrganizerId("IOSR")).toBe("iosr");
    expect(resolveOrganizerId("Odia Wikimedians User Group")).toBe("odia-wikimedians");
    expect(getOrganizerById("odia-wikimedians").kind).toBe("community");
    expect(getOrganizerById("iosr").collectionMode).toBe("manual");
  });

  it("publishes their verified events with exact dates and attendance evidence", () => {
    const byUrl = new Map(events.map((event) => [event.url, event]));
    const nlc = byUrl.get("https://iosrodisha.in/nlc/index.html");
    expect(nlc).toMatchObject({
      organizerId: "iosr",
      community: "Institute of Odia Studies and Research",
      type: "Conference",
      startDate: "2026-11-13",
      endDate: "2026-11-16",
    });
    expect(
      byUrl.get(
        "https://enewsinsight.com/odia-wikipedia-workshop-held-at-gangadhar-mahapatra-law-college-in-puri/",
      ),
    ).toMatchObject({ organizerId: "odia-wikimedians", type: "Workshop", startDate: "2026-03-06" });
    expect(
      byUrl.get(
        "https://dailyodisha.gapu.in/2026/09/odisha-wikimedia-community-marks-wikipedia-25th-birthday.html",
      ),
    ).toMatchObject({ organizerId: "odia-wikimedians", type: "Talk", startDate: "2026-07-13" });
    for (const event of events.filter(
      (e) => e.organizerId === "iosr" || e.organizerId === "odia-wikimedians",
    )) {
      expect(event.attendance?.note.trim()).toBeTruthy();
    }
  });
});
