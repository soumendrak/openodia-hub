import { describe, it, expect } from "vitest";
import { REGISTRATION_STATES } from "../src/data/events/types";
import { eventListSchema, serializeJsonLd } from "../src/lib/jsonld";

describe("serializeJsonLd", () => {
  it("escapes < so remote content can't close the script tag", () => {
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  it("round-trips back to the original data", () => {
    const data = { name: "a <b> c", nested: { list: ["</script>"] } };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});

describe("eventListSchema", () => {
  const NOW = new Date("2026-06-15T08:00:00Z");
  const base = {
    name: "Workshop",
    url: "https://example.org/event",
    description: "d",
    startDate: "2026-07-01",
    organizer: "NIT Rourkela",
  };
  const item = (e: Parameters<typeof eventListSchema>[0][number]) =>
    eventListSchema([e], NOW).itemListElement[0].item as Record<string, unknown>;

  it("emits organizer.url and a free INR offer for an upcoming free event", () => {
    const out = item({ ...base, organizerUrl: "https://www.nitrkl.ac.in/", free: true });
    expect(out.organizer).toEqual({
      "@type": "Organization",
      name: "NIT Rourkela",
      url: "https://www.nitrkl.ac.in/",
    });
    expect(out.isAccessibleForFree).toBe(true);
    expect(out.offers).toEqual({
      "@type": "Offer",
      price: 0,
      priceCurrency: "INR",
      url: "https://example.org/event",
      availability: "https://schema.org/InStock",
    });
    expect(JSON.parse(serializeJsonLd(eventListSchema([base], NOW)))).toBeTruthy();
  });

  it("emits no offer once a free event has ended, judged by endDate", () => {
    const ended = item({ ...base, startDate: "2026-02-07", endDate: "2026-02-16", free: true });
    expect(ended.isAccessibleForFree).toBe(true);
    expect(ended).not.toHaveProperty("offers");
    const running = item({ ...base, startDate: "2026-06-10", endDate: "2026-06-15", free: true });
    expect(running).toHaveProperty("offers");
  });

  it("states isAccessibleForFree=false for a fee-based event and offers nothing", () => {
    const out = item({ ...base, free: false });
    expect(out.isAccessibleForFree).toBe(false);
    expect(out).not.toHaveProperty("offers");
  });

  it("omits fields it has no real data for instead of inventing them", () => {
    const out = item(base);
    expect(out.organizer).toEqual({ "@type": "Organization", name: "NIT Rourkela" });
    for (const k of ["image", "performer", "offers", "isAccessibleForFree"]) {
      expect(out).not.toHaveProperty(k);
    }
  });

  it("marks an 'Online' location as an online event, not a physical Place", () => {
    const out = item({ ...base, location: " Online " });
    expect(out.eventAttendanceMode).toBe("https://schema.org/OnlineEventAttendanceMode");
    expect(out.location).toEqual({ "@type": "VirtualLocation" });
    expect(out.url).toBe(base.url);
    const venue = item({
      ...base,
      location: "NIT Rourkela",
      joinUrl: "https://meet.google.com/abc-defg-hij",
    });
    expect(venue.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(venue.location).toEqual({
      "@type": "Place",
      name: "NIT Rourkela",
      address: "NIT Rourkela",
    });
  });

  it("uses a reviewed join URL as VirtualLocation.url and never the event info page", () => {
    const info = "https://www.nitrkl.ac.in/docs/Workshop/CS/brochure.pdf";
    const join = "https://meet.google.com/abc-defg-hij";
    const attended = item({ ...base, url: info, location: "Online", joinUrl: join });
    expect(attended.url).toBe(info);
    expect(attended.location).toEqual({ "@type": "VirtualLocation", url: join });
    const archive = item({
      ...base,
      url: "https://osou.ac.in/training-programmes-fdp-workshop.html",
      location: "Online",
    });
    expect(archive.url).toBe("https://osou.ac.in/training-programmes-fdp-workshop.html");
    expect(archive.location).toEqual({ "@type": "VirtualLocation" });
    const unspecified = item(base);
    expect(unspecified.location).toEqual({ "@type": "VirtualLocation" });
  });
});

describe("eventListSchema offers gating (lifecycle and registration)", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const base = {
    name: "Future free event",
    url: "https://example.org/e",
    description: "d",
    startDate: "2026-12-01",
    free: true,
  };
  const evidence = { evidenceUrl: "https://example.org/notice", verifiedAt: "2026-09-30" };
  const item = (extra: Record<string, unknown>) =>
    eventListSchema([{ ...base, ...extra }], now).itemListElement[0].item as Record<
      string,
      unknown
    >;

  it("emits an InStock offer for a scheduled free future event", () => {
    expect(item({})).toHaveProperty("offers.availability", "https://schema.org/InStock");
    expect(item({ lifecycle: { state: "scheduled", ...evidence } })).toHaveProperty("offers");
    expect(item({ registration: { state: "open" } })).toMatchObject({
      offers: { url: base.url, availability: "https://schema.org/InStock" },
    });
  });

  it("points an open free offer at the reviewed registration URL", () => {
    const registrationUrl = "https://example.org/register";
    expect(
      item({ registration: { state: "open", url: registrationUrl, ...evidence } }),
    ).toMatchObject({
      offers: { url: registrationUrl, price: 0, availability: "https://schema.org/InStock" },
    });
  });

  it.each(["cancelled", "postponed"] as const)(
    "omits offers for a %s future free event",
    (state) => {
      const it = item({ lifecycle: { state, ...evidence } });
      expect(it).not.toHaveProperty("offers");
      expect(it.isAccessibleForFree).toBe(true);
    },
  );

  it.each(REGISTRATION_STATES.filter((state) => state !== "open"))(
    "omits offers when registration is %s",
    (state) => {
      const out = item({ registration: { state } });
      expect(out).not.toHaveProperty("offers");
      expect(out.isAccessibleForFree).toBe(true);
    },
  );
});

describe("eventListSchema offer expiry in IST", () => {
  const free = {
    name: "Workshop",
    url: "https://example.org/event",
    description: "d",
    free: true as const,
  };
  const offer = (event: Parameters<typeof eventListSchema>[0][number], now: Date) =>
    eventListSchema([event], now).itemListElement[0].item as Record<string, unknown>;

  it("keeps a free offer through the end date in IST and drops it from 00:00 IST the next day", () => {
    const ended = { ...free, startDate: "2026-02-07", endDate: "2026-02-16" };
    expect(offer(ended, new Date("2026-02-16T18:00:00.000Z"))).toHaveProperty("offers");
    expect(offer(ended, new Date("2026-02-16T18:30:00.000Z"))).not.toHaveProperty("offers");
    expect(offer(ended, new Date("2026-02-16T23:59:00.000Z"))).not.toHaveProperty("offers");
    expect(offer(ended, new Date("2026-02-17T00:00:00.000Z"))).not.toHaveProperty("offers");
  });

  it("judges a free event with no end date by its start date in IST", () => {
    const oneDay = { ...free, startDate: "2026-02-16" };
    expect(offer(oneDay, new Date("2026-02-16T18:00:00.000Z"))).toHaveProperty("offers");
    expect(offer(oneDay, new Date("2026-02-16T18:30:00.000Z"))).not.toHaveProperty("offers");
  });
});

describe("eventListSchema offer destination", () => {
  it("points the offer at the reviewed registration URL when present", () => {
    const item = eventListSchema(
      [
        {
          name: "Open event",
          url: "https://example.org/e",
          description: "d",
          startDate: "2099-12-01",
          free: true,
          registration: { state: "open", url: "https://example.org/register" },
        },
      ],
      new Date("2026-10-01T00:00:00Z"),
    ).itemListElement[0].item;
    expect(item).toHaveProperty("offers.url", "https://example.org/register");
  });
});
