import { describe, expect, it } from "vitest";
import { gdgocKiitEvents } from "../src/data/events/gdgoc-kiit";
import { mergeEventCollectionsByUrl } from "../src/lib/event-url";
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
