import { describe, it, expect } from "vitest";
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
  const base = {
    name: "Workshop",
    url: "https://example.org/event",
    description: "d",
    startDate: "2026-02-07",
    organizer: "NIT Rourkela",
  };
  const item = (e: Parameters<typeof eventListSchema>[0][number]) =>
    eventListSchema([e]).itemListElement[0].item as Record<string, unknown>;

  it("emits organizer.url, image, performer and a free INR offer when sourced", () => {
    const out = item({
      ...base,
      organizerUrl: "https://www.nitrkl.ac.in/",
      image: "https://example.org/poster.png",
      performers: ["Ada Lovelace"],
      free: true,
    });
    expect(out.organizer).toEqual({
      "@type": "Organization",
      name: "NIT Rourkela",
      url: "https://www.nitrkl.ac.in/",
    });
    expect(out.image).toEqual(["https://example.org/poster.png"]);
    expect(out.performer).toEqual([{ "@type": "Person", name: "Ada Lovelace" }]);
    expect(out.offers).toEqual({
      "@type": "Offer",
      price: 0,
      priceCurrency: "INR",
      url: "https://example.org/event",
      availability: "https://schema.org/InStock",
    });
    expect(JSON.parse(serializeJsonLd(eventListSchema([base])))).toBeTruthy();
  });

  it("omits fields it has no real data for instead of inventing them", () => {
    const out = item(base);
    expect(out.organizer).toEqual({ "@type": "Organization", name: "NIT Rourkela" });
    expect(out).not.toHaveProperty("image");
    expect(out).not.toHaveProperty("performer");
    expect(out).not.toHaveProperty("offers");
    expect(item({ ...base, performers: [], free: false })).not.toHaveProperty("offers");
  });
});
