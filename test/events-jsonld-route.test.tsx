import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Renders the real /events route over the real bundled event data and reads
// the emitted JSON-LD, so both the route's field mapping and the data itself
// are under test.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => vi.fn(),
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({ data: undefined, fetchNextPage: vi.fn(), hasNextPage: false }),
  useQuery: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: ReactNode }) => children,
}));

import { Route } from "../src/routes/events";
import { events } from "../src/data/events";
import { getOrganizerById, organizerHomepage } from "../src/data/organizers";

type Item = Record<string, unknown> & { organizer?: { name: string; url?: string } };

function renderedEvents(): Item[] {
  const Component = (Route as unknown as { options: { component: () => ReactNode } }).options
    .component;
  render(<Component />);
  const lists = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => JSON.parse(s.textContent ?? "{}"))
    .filter((d) => d["@type"] === "ItemList");
  expect(lists).toHaveLength(1);
  return lists[0].itemListElement.map((li: { item: Item }) => li.item);
}

afterEach(cleanup);

describe("/events JSON-LD", () => {
  it("maps every dated event's fields from the data", () => {
    const items = renderedEvents();
    const dated = events.filter((e) => e.startDate);
    expect(items).toHaveLength(dated.length);
    dated.forEach((e, i) => {
      const it = items[i];
      expect(it.name).toBe(e.title);
      expect(it.url).toBe(e.url);
      expect(it.description).toBe(e.description);
      expect(it.startDate).toBe(e.startDate);
      expect(it.endDate).toBe(e.endDate);
      if (e.location && !/^online$/i.test(e.location.trim())) {
        expect(it.location).toMatchObject({ "@type": "Place", name: e.location });
      }
      const org = e.organizerId ? getOrganizerById(e.organizerId) : undefined;
      expect(it.organizer?.name).toBe(org?.canonicalName ?? e.community);
      expect(it.organizer?.url).toBe(org ? organizerHomepage(org.officialLinks) : undefined);
      if (e.free === undefined) expect(it).not.toHaveProperty("isAccessibleForFree");
      else expect(it.isAccessibleForFree).toBe(e.free);
    });
  });

  it("marks the NIT Rourkela no-fee workshop free (fails if free:true is dropped)", () => {
    const it = renderedEvents().find((i) =>
      String(i.name).startsWith("Problem-Driven AI: Real-World Applications"),
    );
    expect(it?.isAccessibleForFree).toBe(true);
    // It ended on 2026-02-16, so no InStock offer may be advertised.
    expect(it).not.toHaveProperty("offers");
  });
});

describe("organizerHomepage", () => {
  it("prefers a website/root link over a listing page", () => {
    expect(
      organizerHomepage([
        { label: "Conference archive", url: "https://x.org/conferences/" },
        { label: "Official website", url: "https://x.org/about" },
      ]),
    ).toBe("https://x.org/about");
    expect(
      organizerHomepage([
        { label: "Events", url: "https://x.org/events" },
        { label: "Main", url: "https://x.org/" },
      ]),
    ).toBe("https://x.org/");
    expect(organizerHomepage([{ label: "Events", url: "https://x.org/events" }])).toBeUndefined();
    expect(organizerHomepage([{ label: "Bad", url: "not a url" }])).toBeUndefined();
    expect(organizerHomepage([])).toBeUndefined();
  });
});

describe("free events data", () => {
  it("never marks an event free whose evidence mentions a fee amount", () => {
    const free = events.filter((e) => e.free);
    expect(free.length).toBeGreaterThan(0);
    for (const e of free) {
      const text = `${e.description} ${e.attendance?.note ?? ""}`;
      expect(text).not.toMatch(/(Rs\.?|₹|INR)\s*\d|fee-based|paid registration/i);
    }
  });
});
