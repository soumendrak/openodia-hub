import { describe, expect, it } from "vitest";
import { dedupeEventsByUrl, eventUrlKey, mergeEventCollectionsByUrl } from "../src/lib/event-url";

describe("eventUrlKey", () => {
  it("canonicalizes chapter-specific GDG cohost destinations", () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    expect(eventUrlKey(`${base}/cohost-gdg-bhubaneswar/`)).toBe(`${base}`);
    expect(eventUrlKey(`${base}/cohost-gdg-on-campus-kiit`)).toBe(`${base}`);
  });

  it("ignores fragments, tracking parameters, query order, and trailing slashes", () => {
    expect(eventUrlKey("https://example.com/event/?b=2&utm_source=gdg&a=1#tickets")).toBe(
      "https://example.com/event?a=1&b=2",
    );
  });

  it("does not strip cohost-like paths on unrelated domains", () => {
    expect(eventUrlKey("https://example.com/event/cohost-special")).toBe(
      "https://example.com/event/cohost-special",
    );
  });

  it("normalizes malformed and root URLs without throwing", () => {
    expect(eventUrlKey("  not a URL/#section/  ")).toBe("not a URL");
    expect(eventUrlKey("https://example.com/#section")).toBe("https://example.com/");
  });
});

describe("dedupeEventsByUrl", () => {
  it("keeps the first event for each destination address", () => {
    const base = "https://gdg.community.dev/events/details/shared-event";
    const first = { title: "Shared event", url: `${base}/cohost-gdg-bhubaneswar` };
    const duplicate = { title: "Shared event edited", url: `${base}/cohost-gdg-kiit` };

    expect(dedupeEventsByUrl([first, duplicate])).toEqual([first]);
  });
});

describe("mergeEventCollectionsByUrl", () => {
  it("merges matching live metadata and appends a new destination", () => {
    const archived = [{ title: "Archived", url: "https://example.com/event/" }];
    const live = [
      { title: "Current", url: "https://example.com/event#registration" },
      { title: "New", url: "https://example.com/new" },
    ];
    expect(
      mergeEventCollectionsByUrl(archived, live, (oldEvent, liveEvent) => ({
        ...oldEvent,
        title: liveEvent.title,
      })),
    ).toEqual([
      { title: "Current", url: "https://example.com/event/" },
      { title: "New", url: "https://example.com/new" },
    ]);
  });
});
