import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../src/data/events/types";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

type LiveEventsPage = { events: Event[]; total: number; nextCursor?: string };
type InfiniteQueryOptions = {
  queryFn: (args: { pageParam: number }) => Promise<LiveEventsPage>;
  getNextPageParam: (lastPage: LiveEventsPage, allPages: unknown[]) => number | undefined;
};

const dataFixture = vi.hoisted(() => ({ events: [] as Event[] }));

const infiniteHarness = vi.hoisted(() => ({
  data: undefined as { pages: LiveEventsPage[] } | undefined,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  lastOptions: undefined as InfiniteQueryOptions | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (options: Record<string, unknown>) => ({ options }),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: InfiniteQueryOptions) => {
    infiniteHarness.lastOptions = options;
    return infiniteHarness;
  },
}));

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  breadcrumbSchema: () => ({}),
  eventListSchema: () => ({}),
}));

vi.mock("../src/data/events", () => ({
  get events() {
    return dataFixture.events;
  },
}));

vi.mock("../src/lib/event-url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/event-url")>();
  return {
    ...actual,
    mergeEventCollectionsByUrl: vi.fn(actual.mergeEventCollectionsByUrl),
    dedupeEventsByUrl: vi.fn(actual.dedupeEventsByUrl),
  };
});

// ---------------------------------------------------------------------------
// Imports of the modules under test (after the mocks above are registered)
// ---------------------------------------------------------------------------

import { Route as EventsRoute } from "../src/routes/events";
import { Route as EventsFeedRoute } from "../src/routes/events-feed";
import { Route as ApiEventsRoute, fetchChapterEvents } from "../src/routes/api/events";
import { mergeEventCollectionsByUrl, dedupeEventsByUrl } from "../src/lib/event-url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoute = { options: any };
const EventsRouteAny = EventsRoute as unknown as AnyRoute;
const EventsFeedRouteAny = EventsFeedRoute as unknown as AnyRoute;
const ApiEventsRouteAny = ApiEventsRoute as unknown as AnyRoute;

const eventsFeedGet = () => EventsFeedRouteAny.options.server.handlers.GET();
const apiEventsGet = (request: Request) =>
  ApiEventsRouteAny.options.server.handlers.GET({ request });

const FIXED_NOW = new Date("2026-06-15T08:00:00.000Z");
const TODAY_IST = "2026-06-15";

const originalFetch = globalThis.fetch;

function clickTimelineNode(label: string) {
  const nodes = screen.getAllByText(label);
  const target = nodes.find((el) => el.closest(".cursor-pointer"));
  if (!target) {
    throw new Error(`No clickable timeline node found for "${label}"`);
  }
  fireEvent.click(target);
}

const PAST_2020: Event[] = [
  {
    year: "2020",
    date: "10 Jan 2020",
    title: "Alpha Talk",
    url: "https://example.com/e1",
    type: "Talk",
    community: "Comm A",
    description: "Alpha description",
  },
  {
    year: "2020",
    date: "Community meetup notes",
    title: "Beta Workshop",
    url: "https://example.com/e2",
    type: "Workshop",
    community: "Comm B",
    description: "Beta description",
  },
  {
    year: "2020",
    date: "5 Mar 2020",
    title: "Gamma Conference",
    url: "https://example.com/e3",
    type: "Conference",
    community: "Comm A",
    description: "Gamma description",
    startDate: "2020-03-05",
    endDate: "2020-03-05",
  },
  {
    year: "2020",
    date: "20 Feb 2020",
    title: "Delta Hackathon",
    url: "https://example.com/e4",
    type: "Hackathon",
    community: "Comm C",
    description: "Delta description",
  },
];

const FAR_FUTURE: Event = {
  year: "2099",
  date: "1 Jan 2099",
  title: "Someday Summit",
  url: "https://example.com/someday",
  type: "Summit",
  community: "Comm D",
  description: "far future desc",
  startDate: "2099-01-01",
  endDate: "2099-01-01",
};

beforeEach(() => {
  dataFixture.events = [];
  infiniteHarness.data = undefined;
  infiniteHarness.hasNextPage = false;
  infiniteHarness.isFetchingNextPage = false;
  infiniteHarness.lastOptions = undefined;
  infiniteHarness.fetchNextPage.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as unknown as { lenis?: unknown }).lenis;
  globalThis.fetch = originalFetch;
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 0, configurable: true });
});

// ---------------------------------------------------------------------------
// src/routes/events.tsx
// ---------------------------------------------------------------------------

describe("events.tsx", () => {
  it("computes page head metadata with an RSS alternate link", () => {
    const head = EventsRouteAny.options.head();
    expect(
      head.links.some(
        (l: { rel: string; href: string }) =>
          l.rel === "alternate" && l.href.includes("events-feed"),
      ),
    ).toBe(true);
    expect(
      head.meta.some((m: { title?: string }) => m.title === "Events · Odia AI Community"),
    ).toBe(true);
  });

  it("falls back to a UTC date string when Intl formatting throws", () => {
    const intlSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl not available");
    });
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getAllByText(/Odia AI/i).length).toBeGreaterThan(0);
    intlSpy.mockRestore();
  });

  it("groups past events by month, resolves a live status window, and sorts entries missing startDate", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    try {
      dataFixture.events = PAST_2020;
      infiniteHarness.data = {
        pages: [
          {
            events: [
              {
                year: "2026",
                date: "15 Jun 2026",
                title: "Live Now Event",
                url: "https://example.com/live-now",
                type: "Talk",
                community: "Comm D",
                description: "live desc",
                startDate: TODAY_IST,
                endDate: "2026-06-20",
              },
            ],
            total: 1,
          },
        ],
      };
      const Component = EventsRouteAny.options.component;
      render(<Component />);

      expect(screen.getByText("Live Now Event")).toBeInTheDocument();
      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.getAllByText("January").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Other").length).toBeGreaterThan(0);
      expect(screen.getAllByText("February").length).toBeGreaterThan(0);
      expect(screen.getAllByText("March").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exercises the live-events queryFn success/error paths and the pagination cursor", async () => {
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    const opts = infiniteHarness.lastOptions;
    expect(opts).toBeDefined();
    if (!opts) return;

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0 }),
    } as Response);
    const page = await opts.queryFn({ pageParam: 1 });
    expect(page).toEqual({ events: [], total: 0 });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/events?page=1&limit=20");

    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
    await expect(opts.queryFn({ pageParam: 2 })).rejects.toThrow("Failed to fetch live events");

    expect(opts.getNextPageParam({ events: [], total: 0, nextCursor: "3" }, [1, 2])).toBe(3);
    expect(opts.getNextPageParam({ events: [], total: 0 }, [1, 2])).toBeUndefined();
  });

  it("shows the load-more control and triggers fetchNextPage", () => {
    infiniteHarness.data = { pages: [{ events: [], total: 5 }] };
    infiniteHarness.hasNextPage = true;
    infiniteHarness.isFetchingNextPage = false;
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: /Load more/i }));
    expect(infiniteHarness.fetchNextPage).toHaveBeenCalled();
  });

  it("shows a spinner in the load-more control while fetching the next page", () => {
    infiniteHarness.data = { pages: [{ events: [], total: 5 }] };
    infiniteHarness.hasNextPage = true;
    infiniteHarness.isFetchingNextPage = true;
    const Component = EventsRouteAny.options.component;
    const { container } = render(<Component />);
    const loadMoreButton = screen.getByRole("button", { name: /Load more/i });
    expect(loadMoreButton).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("orders past events missing a startDate in both comparator directions", () => {
    dataFixture.events = [
      {
        year: "2021",
        date: "5 Jan 2021",
        title: "Has Start",
        url: "https://example.com/has-start",
        type: "Talk",
        community: "Comm A",
        description: "d",
        startDate: "2021-01-05",
        endDate: "2021-01-05",
      },
      {
        year: "2021",
        date: "Prose only",
        title: "No Start",
        url: "https://example.com/no-start",
        type: "Talk",
        community: "Comm A",
        description: "d",
      },
    ];
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByText("Has Start")).toBeInTheDocument();
    expect(screen.getByText("No Start")).toBeInTheDocument();
  });

  it("falls back to prose month parsing when startDate is malformed", () => {
    dataFixture.events = [
      {
        year: "2023",
        date: "prose without month",
        title: "Malformed Start Dash",
        url: "https://example.com/malformed-1",
        type: "Talk",
        community: "Comm A",
        description: "d",
        startDate: "2023",
      },
      {
        year: "2023",
        date: "prose without month",
        title: "Malformed Start Month",
        url: "https://example.com/malformed-2",
        type: "Talk",
        community: "Comm A",
        description: "d",
        startDate: "2023-13-01",
      },
    ];
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByText("Malformed Start Dash")).toBeInTheDocument();
    expect(screen.getByText("Malformed Start Month")).toBeInTheDocument();
    expect(screen.getAllByText("Other").length).toBeGreaterThan(0);
  });

  it("tolerates timeline targets that are momentarily missing from the DOM", () => {
    dataFixture.events = PAST_2020;
    infiniteHarness.data = { pages: [{ events: [FAR_FUTURE], total: 1 }] };
    const Component = EventsRouteAny.options.component;
    render(<Component />);

    document.getElementById("month-2020-january")?.remove();
    document.getElementById("year-2020")?.remove();
    fireEvent.scroll(window);

    expect(screen.getAllByText(/Odia AI/i).length).toBeGreaterThan(0);
  });

  it("filters by search text, type, and community, and clears active filters", () => {
    dataFixture.events = PAST_2020;
    const Component = EventsRouteAny.options.component;
    render(<Component />);

    const searchInput = screen.getByPlaceholderText(/Search events/i);
    fireEvent.change(searchInput, { target: { value: "Alpha" } });
    expect(screen.getByText("1 event matched")).toBeInTheDocument();
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    expect(screen.queryByText("Beta Workshop")).not.toBeInTheDocument();

    const clearQueryButton = searchInput.parentElement!.querySelector("button")!;
    fireEvent.click(clearQueryButton);
    expect(searchInput).toHaveValue("");

    const [communitySelect, typeSelect] = screen.getAllByRole("combobox");

    fireEvent.change(communitySelect, { target: { value: "Comm A" } });
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    expect(screen.queryByText("Delta Hackathon")).not.toBeInTheDocument();

    fireEvent.change(communitySelect, { target: { value: "" } });
    fireEvent.change(typeSelect, { target: { value: "Conference" } });
    expect(screen.getByText("Gamma Conference")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Talk")).not.toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: "" } });
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();

    fireEvent.change(communitySelect, { target: { value: "Comm C" } });
    expect(screen.getByText("Delta Hackathon")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Talk")).not.toBeInTheDocument();

    const clearFiltersButton = screen.getByRole("button", { name: /Clear Filters/i });
    fireEvent.click(clearFiltersButton);
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    expect(screen.getByText("Delta Hackathon")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No events matched.")).toBeInTheDocument();
  });

  it("skips the scroll-spy handler when no timeline targets are present", () => {
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getAllByText(/Odia AI/i).length).toBeGreaterThan(0);
    expect(document.getElementById("upcoming-events")).toBeNull();
  });

  it("updates the active timeline section for bottom-of-page and mid-page scroll positions", () => {
    dataFixture.events = PAST_2020;
    infiniteHarness.data = { pages: [{ events: [FAR_FUTURE], total: 1 }] };
    const Component = EventsRouteAny.options.component;
    render(<Component />);

    window.scrollTo = vi.fn();

    // Bottom-of-page edge case.
    Object.defineProperty(window, "scrollY", { value: 500, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    fireEvent.scroll(window);

    // Standard scroll-spy loop: some targets above, some below the 160px threshold.
    const rectTops: Record<string, number> = {
      "upcoming-events": 50,
      "year-2020": 100,
      "month-2020-january": 200,
      "month-2020-other": 250,
      "month-2020-february": 300,
      "month-2020-march": 350,
    };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        top: rectTops[this.id] ?? 999,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 5000,
      configurable: true,
    });
    fireEvent.scroll(window);

    expect(document.getElementById("year-2020")).not.toBeNull();
  });

  it("navigates the timeline via lenis smooth-scroll, the native fallback, and releases the scroll lock on unmount", () => {
    dataFixture.events = PAST_2020;
    infiniteHarness.data = { pages: [{ events: [FAR_FUTURE], total: 1 }] };
    window.scrollTo = vi.fn();
    // window.scrollY falsy so the native fallback exercises the
    // document.documentElement.scrollTop side of the "||" as well.
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    vi.useFakeTimers();
    try {
      const Component = EventsRouteAny.options.component;
      const { unmount } = render(<Component />);

      // Native fallback branch (no window.lenis yet).
      clickTimelineNode("Upcoming");
      expect(window.scrollTo).toHaveBeenCalled();

      // Programmatic-scroll guard: a scroll event right after should be ignored.
      fireEvent.scroll(window);

      // Second click before the 1500ms release timer fires exercises the
      // clearTimeout(timeoutRef.current) branch, and sets activeSection to a
      // "year-" id.
      clickTimelineNode("2020");
      clickTimelineNode("2020");

      // Expands the month accordion (isActiveYear true) and clicks a month
      // node, exercising the "month-" activeSection parsing branch.
      clickTimelineNode("January");

      // Lenis smooth-scroll branch, with its own nested completion timer.
      const lenisScrollTo = vi.fn((_el: HTMLElement, options?: { onComplete?: () => void }) => {
        options?.onComplete?.();
      });
      (window as unknown as { lenis?: unknown }).lenis = { scrollTo: lenisScrollTo };
      clickTimelineNode("Upcoming");
      expect(lenisScrollTo).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // A fresh pending release timer, released via effect cleanup on unmount.
      clickTimelineNode("Upcoming");

      // scrollToId no-ops safely when its target has disappeared from the DOM.
      document.getElementById("upcoming-events")?.remove();
      clickTimelineNode("Upcoming");

      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// src/routes/events-feed.ts
// ---------------------------------------------------------------------------

describe("events-feed.ts", () => {
  it("escapes reserved XML characters in generated RSS content", async () => {
    dataFixture.events = [
      {
        year: "2022",
        date: "1 Jan 2022",
        title: `<Tag> & 'Quote' "Dquote"`,
        url: "https://example.com/xml-escape",
        type: "Talk",
        community: "Comm <A> & 'B'",
        description: "Desc <b>bold</b>",
        location: "Venue <X> & 'Y'",
      },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    const response = await eventsFeedGet();
    const xml = await response.text();
    expect(xml).toContain("&lt;Tag&gt; &amp; &apos;Quote&apos; &quot;Dquote&quot;");
  });

  it("falls back to defaults when optional RSS fields are empty", async () => {
    dataFixture.events = [
      {
        year: "2022",
        date: "1 Jan 2022",
        title: "",
        url: "",
        type: "" as Event["type"],
        community: "",
        description: "",
      },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    const response = await eventsFeedGet();
    const xml = await response.text();
    expect(xml).toContain("<title>Untitled Event</title>");
    expect(xml).toContain('isPermaLink="false"');
    expect(xml).toContain("<category>Talk</category>");
    expect(xml).toContain("Organized by:</strong> Odia AI Community");
  });

  it("formats the RFC822 pubDate for missing, invalid, and year-derived dates", async () => {
    dataFixture.events = [
      {
        year: "2021",
        date: "",
        title: "No Date Event",
        url: "https://example.com/nodate",
        type: "Talk",
        community: "Comm A",
        description: "desc",
      },
      {
        year: "2025",
        date: "banana",
        title: "Invalid Date Valid Year",
        url: "https://example.com/invalid-valid-year",
        type: "Talk",
        community: "Comm A",
        description: "desc",
      },
      {
        year: "abc",
        date: "banana",
        title: "Invalid Date Invalid Year",
        url: "https://example.com/invalid-invalid-year",
        type: "Talk",
        community: "Comm A",
        description: "desc",
      },
      {
        year: "",
        date: "banana",
        title: "Invalid Date No Year",
        url: "https://example.com/invalid-no-year",
        type: "Talk",
        community: "Comm A",
        description: "desc",
      },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    const response = await eventsFeedGet();
    const xml = await response.text();

    const pubDateFor = (title: string): string => {
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = xml.match(
        new RegExp(`<title>${escaped}</title>[\\s\\S]*?<pubDate>(.*?)</pubDate>`),
      );
      if (!match) throw new Error(`item not found for "${title}"`);
      return match[1];
    };

    expect(pubDateFor("No Date Event").endsWith("GMT")).toBe(true);
    expect(pubDateFor("Invalid Date Valid Year")).toBe(new Date(2025, 0, 1).toUTCString());
    expect(pubDateFor("Invalid Date Invalid Year").endsWith("GMT")).toBe(true);
    expect(pubDateFor("Invalid Date No Year").endsWith("GMT")).toBe(true);
  });

  it("marks events live across the merge window and sorts entries missing startDate", async () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

      const liveEvent: Event = {
        year: "2026",
        date: "15 Jun 2026",
        title: "Live Window Event",
        url: "https://example.com/live-window",
        type: "Talk",
        community: "Comm Z",
        description: "live desc",
        startDate: TODAY_IST,
        endDate: "2026-06-20",
      };
      const noStart = (n: number): Event => ({
        year: "2026",
        date: "Prose without month",
        title: `NoStart ${n}`,
        url: `https://example.com/nostart-${n}`,
        type: "Talk",
        community: "Comm Z",
        description: `d${n}`,
      });

      // 4-element ordering: the live event is inserted last, exercising the
      // "a has startDate" comparator branch.
      dataFixture.events = [noStart(1), noStart(2), noStart(3), liveEvent];
      let response = await eventsFeedGet();
      expect(response.status).toBe(200);
      let xml = await response.text();
      expect(xml).toContain("Live Window Event");
      expect(xml).toContain("NoStart 1");
      expect(xml).toContain("NoStart 2");
      expect(xml).toContain("NoStart 3");

      // 2-element ordering [hasStart, noStart]: Array.prototype.sort always
      // calls comparator(arr[1], arr[0]) first for a 2-element array, so this
      // deterministically exercises the "b has startDate" comparator branch.
      dataFixture.events = [liveEvent, noStart(4)];
      response = await eventsFeedGet();
      expect(response.status).toBe(200);
      xml = await response.text();
      expect(xml).toContain("Live Window Event");
      expect(xml).toContain("NoStart 4");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the UTC date string when Intl formatting throws while computing today's date", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const intlSpy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl not available");
    });
    const response = await eventsFeedGet();
    expect(response.status).toBe(200);
    intlSpy.mockRestore();
  });

  it("returns 500 when the merge pipeline throws", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    (mergeEventCollectionsByUrl as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("merge boom");
    });

    const response = await eventsFeedGet();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(consoleErrorSpy).toHaveBeenCalledWith("RSS feed generation error:", expect.any(Error));
  });
});

// ---------------------------------------------------------------------------
// src/routes/api/events.ts
// ---------------------------------------------------------------------------

describe("api/events.ts", () => {
  it("returns an empty date string when Date construction throws", async () => {
    const RealDate = globalThis.Date;
    class ThrowingDate extends RealDate {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        if (args.length === 1 && args[0] === "BOOMDATE") {
          throw new RangeError("simulated invalid date");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(...(args as any));
      }
    }
    vi.stubGlobal("Date", ThrowingDate);

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: {
              results: [
                {
                  title: "Boom Event",
                  description: "desc",
                  event_type_title: "Talk",
                  start_date: "BOOMDATE",
                  url: "https://gdg.community.dev/events/details/boom-event",
                },
              ],
            },
            pastEvents: { results: [] },
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => html } as Response);

    const events = await fetchChapterEvents("Community", "chapter");
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe("");

    vi.unstubAllGlobals();
  });

  it("returns no events when prerenderData is missing from a hydrated page", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: {} },
    })}</script>`;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => html } as Response);

    const events = await fetchChapterEvents("Community", "chapter");
    expect(events).toEqual([]);
  });

  it("returns 500 when dedupe throws during live event ingestion", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    (dedupeEventsByUrl as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("dedupe boom");
    });

    const response = await apiEventsGet(new Request("https://openodia.com/api/events"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ events: [] });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Live events ingestion error:", expect.any(Error));
  });

  it("falls back to empty upcoming results and a default event type when Bevy data omits them", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            pastEvents: {
              results: [
                {
                  title: "Untyped Past Event",
                  description: "desc",
                  event_type_title: "",
                  start_date: "2026-01-02T00:00:00Z",
                  url: "https://gdg.community.dev/events/details/untyped-event",
                },
              ],
            },
          },
        },
      },
    })}</script>`;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => html } as Response);

    const events = await fetchChapterEvents("Community", "chapter");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("Talk");
  });

  it("applies default pagination when the limit is absent or the page value is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    const noLimit = await apiEventsGet(new Request("https://openodia.com/api/events?page=1"));
    expect((await noLimit.json()).events).toEqual([]);

    const emptyPageBadLimit = await apiEventsGet(
      new Request("https://openodia.com/api/events?page=&limit=abc"),
    );
    expect((await emptyPageBadLimit.json()).events).toEqual([]);
  });
});
