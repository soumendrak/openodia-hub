import { describe, expect, it } from "vitest";
import { gdgBhubaneswarEvents } from "../src/data/events/gdg-bhubaneswar";
import { gdgocKiitEvents } from "../src/data/events/gdgoc-kiit";
import { eventUrlKey, mergeEventCollectionsByUrl } from "../src/lib/event-url";
import { mergeNonEmpty } from "../src/lib/utils";

describe("GDGoC KIIT event data", () => {
  it("merges the archived and live August 2026 Deploy event into one destination", () => {
    const destination =
      "https://gdg.community.dev/events/details/google-gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india-presents-deploy-or-redacted/";
    const archived = gdgocKiitEvents.find((event) => event.startDate === "2026-08-08");
    expect(archived).toMatchObject({
      title: "Deploy or [REDACTED]",
      url: destination,
    });

    const live = {
      ...archived!,
      community: "GDGoC KIIT",
      url: destination,
    };
    const rendered = mergeEventCollectionsByUrl([archived!], [live], mergeNonEmpty);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ title: "Deploy or [REDACTED]", url: destination });
  });

  it("does not retain the redirected legacy Deploy URL", () => {
    expect(gdgocKiitEvents.some((event) => event.url.endsWith("/deploy-or-die/"))).toBe(false);
  });
});

describe("GDG Bhubaneswar event data", () => {
  it("retains only the July record at the redirected Code for Communities destination", () => {
    const destination =
      "https://gdg.community.dev/events/details/google-gdg-bhubaneswar-presents-build-with-ai-code-for-communities/";
    const matches = gdgBhubaneswarEvents.filter(
      (event) => eventUrlKey(event.url) === eventUrlKey(destination),
    );

    expect(matches).toEqual([
      expect.objectContaining({
        title: "Build with AI: Code for Communities",
        startDate: "2026-07-05",
      }),
    ]);
  });

  it("classifies Code for Communities 2.0 as a hackathon", () => {
    expect(
      gdgBhubaneswarEvents.find((event) => event.title === "Code for Communities 2.0"),
    ).toMatchObject({ type: "Hackathon" });
  });
});
