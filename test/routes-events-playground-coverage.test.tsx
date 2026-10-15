import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../src/data/events/types";
import { eventListSchema } from "../src/lib/jsonld";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

type LiveEventsPage = {
  events: Event[];
  total: number;
  nextCursor?: string;
  partial?: boolean;
  years?: string[];
};
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
  isFetchNextPageError: false,
  lastOptions: undefined as InfiniteQueryOptions | undefined,
}));

const routeHarness = vi.hoisted(() => ({
  search: {} as {
    q?: string;
    year?: string;
    sort?: "oldest";
    community?: string;
    type?: Event["type"];
  },
  listeners: new Set<() => void>(),
  navigate: vi.fn(),
}));

const queryHarness = vi.hoisted(() => ({
  data: undefined as { events: Event[] } | undefined,
  isPending: false,
  isError: false,
  lastOptions: undefined as
    | { queryFn: () => Promise<{ events: Event[] }>; enabled: boolean }
    | undefined,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (callback: () => Promise<unknown>) => callback }),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({ to, hash, children, ...rest }: { to: string; hash?: string; children: ReactNode }) => (
      <a href={`${to}${hash ? "#" + hash : ""}`} {...rest}>
        {children}
      </a>
    ),
    createFileRoute: (_path: string) => (options: Record<string, unknown>) => ({
      options,
      useLoaderData: () => ({ events: dataFixture.events }),
      useSearch: () =>
        React.useSyncExternalStore(
          (listener) => {
            routeHarness.listeners.add(listener);
            return () => routeHarness.listeners.delete(listener);
          },
          () => routeHarness.search,
        ),
      useNavigate: () => routeHarness.navigate,
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: InfiniteQueryOptions) => {
    infiniteHarness.lastOptions = options;
    return infiniteHarness;
  },
  useQuery: (options: { queryFn: () => Promise<{ events: Event[] }>; enabled: boolean }) => {
    queryHarness.lastOptions = options;
    return {
      data: queryHarness.data,
      isPending: queryHarness.isPending,
      isError: queryHarness.isError,
    };
  },
}));

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  breadcrumbSchema: () => ({}),
  eventListSchema: vi.fn(() => ({})),
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
    community: "TFUG BBSR",
    description: "Alpha description",
  },
  {
    year: "2020",
    date: "Community meetup notes",
    title: "Beta Workshop",
    url: "https://example.com/e2",
    type: "Workshop",
    community: "GDG Bhubaneswar",
    description: "Beta description",
  },
  {
    year: "2020",
    date: "5 Mar 2020",
    title: "Gamma Conference",
    url: "https://example.com/e3",
    type: "Conference",
    community: "TFUG BBSR",
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
    community: "OdishaAI",
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
  infiniteHarness.isFetchNextPageError = false;
  infiniteHarness.lastOptions = undefined;
  infiniteHarness.fetchNextPage.mockClear();
  routeHarness.search = {};
  routeHarness.navigate.mockClear();
  routeHarness.navigate.mockImplementation(({ search }) => {
    routeHarness.search = search;
    routeHarness.listeners.forEach((listener) => listener());
  });
  queryHarness.data = undefined;
  queryHarness.isPending = false;
  queryHarness.isError = false;
  queryHarness.lastOptions = undefined;
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
  it("loads reviewed initial server data without blocking on a live scrape", async () => {
    dataFixture.events = PAST_2020;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("no live request expected");
    });
    const initial = await EventsRouteAny.options.loader();
    expect(initial.events).toHaveLength(PAST_2020.length);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("keeps cancellations and unresolved postponements visible outside active and past recommendations", () => {
    const proof = { evidenceUrl: "https://example.com/official", verifiedAt: "2026-10-12" };
    dataFixture.events = [
      {
        ...PAST_2020[0],
        url: "https://example.com/cancelled",
        title: "Cancelled future",
        year: "2099",
        startDate: "2099-01-01",
        lifecycle: { state: "cancelled", ...proof },
      },
      {
        ...PAST_2020[0],
        url: "https://example.com/postponed",
        title: "Unresolved future",
        year: "2099",
        startDate: "2099-01-01",
        lifecycle: { state: "postponed", ...proof },
      },
    ];
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    const section = screen.getByRole("region", { name: "Cancelled or postponed" });
    expect(section).toHaveTextContent("Cancelled future");
    expect(section).toHaveTextContent("Unresolved future");
    expect(screen.queryByRole("heading", { name: "Upcoming" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Past Events" })).not.toBeInTheDocument();
    expect(document.querySelector("a a")).toBeNull();
  });
  it("uses replacement dates in active cards and preserves separate registration and eligibility", () => {
    const proof = { evidenceUrl: "https://example.com/official", verifiedAt: "2026-10-12" };
    dataFixture.events = [
      {
        ...PAST_2020[0],
        date: "10 Jan 2027",
        year: "2027",
        startDate: "2027-01-10",
        endDate: "2027-01-11",
        lifecycle: {
          state: "postponed",
          previousDate: "2027-01-10",
          replacementDate: "2099-03-01",
          ...proof,
        },
        registration: { state: "closed", ...proof },
        attendance: { policy: "public", note: "Public audience" },
      },
    ];
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByText(/Rescheduled/)).toHaveTextContent("2099-03-01");
    expect(screen.getByText(/Original date:/)).toHaveTextContent("2027-01-10");
    expect(screen.getByText(/Registration closed/)).toBeInTheDocument();
    expect(screen.getByText("Open to all")).toBeInTheDocument();
    expect(screen.queryByText(/free/i)).not.toBeInTheDocument();
  });
  it("does not invent an original date when a rescheduling notice gives only the new date", () => {
    const proof = { evidenceUrl: "https://example.com/official", verifiedAt: "2026-10-12" };
    dataFixture.events = [
      {
        ...PAST_2020[0],
        startDate: "2099-01-10",
        year: "2099",
        lifecycle: { state: "postponed", replacementDate: "2099-03-01", ...proof },
      },
    ];
    render(<EventsRouteAny.options.component />);
    expect(screen.getByText(/Original date:/)).toHaveTextContent("unknown");
    expect(screen.getByText(/Rescheduled/)).toHaveTextContent("2099-03-01");
    const schemaEvents = vi.mocked(eventListSchema).mock.calls.at(-1)![0];
    expect(schemaEvents[0].previousStartDate).toBeUndefined();
    expect(schemaEvents[0].startDate).toBe("2099-03-01");
  });
  it("ignores a cached full-search corpus after filters are cleared", () => {
    dataFixture.events = [];
    infiniteHarness.data = { pages: [{ events: [PAST_2020[0]], total: 2, nextCursor: "2" }] };
    infiniteHarness.hasNextPage = true;
    queryHarness.data = { events: PAST_2020 };
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    expect(screen.queryByText("Beta Workshop")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    expect(queryHarness.lastOptions?.enabled).toBe(false);
  });
  it.each([{ year: "2020" }, { sort: "oldest" as const }, { q: "Alpha" }])(
    "warns when the active full-corpus query fails after paginated data succeeds: %j",
    (search) => {
      dataFixture.events = PAST_2020;
      routeHarness.search = search;
      infiniteHarness.data = { pages: [{ events: [], total: 0, partial: false }] };
      queryHarness.isError = true;
      const Component = EventsRouteAny.options.component;
      render(<Component />);
      expect(queryHarness.lastOptions?.enabled).toBe(true);
      expect(screen.getByText(/Known events remain listed/)).not.toHaveAttribute("role");
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    },
  );
  it("does not reuse a disabled full-query error after archive filters clear", () => {
    dataFixture.events = PAST_2020;
    queryHarness.isError = true;
    infiniteHarness.data = { pages: [{ events: [], total: 0, partial: false }] };
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(queryHarness.lastOptions?.enabled).toBe(false);
    expect(screen.queryByText(/Known events remain listed/)).not.toBeInTheDocument();
  });
  it("shows partial-source warnings while retaining checked-in events", () => {
    dataFixture.events = PAST_2020;
    infiniteHarness.data = { pages: [{ events: [], total: 0, partial: true }] };
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    const warning = screen.getByText(/Known events remain listed/);
    expect(warning).toHaveTextContent("does not confirm registration");
    expect(warning).not.toHaveAttribute("role");
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
  });

  it("restores canonical year/sort filters, searches all pages, and clears year state", () => {
    dataFixture.events = [
      ...PAST_2020,
      {
        ...PAST_2020[0],
        year: "2021",
        title: "Newer event",
        url: "https://example.com/newer",
        startDate: "2021-01-01",
      },
    ];
    routeHarness.search = { year: "2020", sort: "oldest" };
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByLabelText("Archive year")).toHaveValue("2020");
    expect(screen.getByLabelText("Event sort")).toHaveValue("oldest");
    expect(screen.queryByText("Newer event")).not.toBeInTheDocument();
    expect(queryHarness.lastOptions?.enabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Archive year"), { target: { value: "2021" } });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { year: "2021", sort: "oldest" },
    });
    fireEvent.change(screen.getByLabelText("Event sort"), { target: { value: "newest" } });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { year: "2021", sort: undefined },
    });
    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/ }));
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { sort: undefined },
      replace: true,
    });
  });

  it("keeps an empty archive-year selection visible and explains the result", () => {
    routeHarness.search = { year: "1999" };
    dataFixture.events = PAST_2020;
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    expect(screen.getByLabelText("Archive year")).toHaveValue("1999");
    expect(screen.getByText("No events matched.")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Talk")).not.toBeInTheDocument();
  });

  it("sorts the canonical archive chronologically across years and dates", () => {
    routeHarness.search = { sort: "oldest" };
    dataFixture.events = [
      {
        ...PAST_2020[0],
        year: "2021",
        date: "1 Jan 2021",
        startDate: "2021-01-01",
        title: "Later year",
        url: "https://example.com/later-year",
      },
      {
        ...PAST_2020[0],
        startDate: "2020-12-01",
        title: "Later date",
        url: "https://example.com/later-date",
      },
      {
        ...PAST_2020[0],
        startDate: "2020-01-01",
        title: "Earlier date",
        url: "https://example.com/earlier-date",
      },
    ];
    const Component = EventsRouteAny.options.component;
    const { container } = render(<Component />);
    const titles = [...container.querySelectorAll("h3 a")].map((element) => element.textContent);
    expect(titles).toEqual(["Earlier date", "Later date", "Later year"]);
    fireEvent.change(screen.getByLabelText("Event sort"), { target: { value: "oldest" } });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({ search: { sort: "oldest" } });
    fireEvent.change(screen.getByLabelText("Archive year"), { target: { value: "" } });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { sort: "oldest", year: undefined },
    });
  });

  it("validates all event filter parameters and preserves honest invalid-ID states", () => {
    expect(
      EventsRouteAny.options.validateSearch({
        q: "kiit",
        community: "gdgoc-kiit",
        type: "Workshop",
      }),
    ).toEqual({ q: "kiit", community: "gdgoc-kiit", type: "Workshop" });
    expect(
      EventsRouteAny.options.validateSearch({ q: 42, community: 42, type: "invalid" }),
    ).toEqual({});
    expect(EventsRouteAny.options.validateSearch({ community: "x".repeat(81) })).toEqual({});
    routeHarness.search = { community: "unknown-id" };
    render(<EventsRouteAny.options.component />);
    expect(screen.getByText(/not a known organizer/)).not.toHaveAttribute("role");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(queryHarness.lastOptions?.enabled).toBe(false);
    expect(screen.getByText("No events matched.")).toBeInTheDocument();
  });
  it.each(["organizer", "type"])(
    "fetches beyond loaded pages for the %s filter and keeps independent links",
    (filter) => {
      const hidden = { ...PAST_2020[0], community: "GDGoC KIIT", type: "Workshop" as const };
      routeHarness.search =
        filter === "organizer" ? { community: "gdgoc-kiit" } : { type: "Workshop" };
      queryHarness.data = { events: [hidden] };
      render(<EventsRouteAny.options.component />);
      expect(queryHarness.lastOptions?.enabled).toBe(true);
      const title = screen.getByRole("link", { name: hidden.title });
      expect(title).toHaveAttribute("href", hidden.url);
      expect(screen.getByRole("link", { name: "GDGoC KIIT", exact: true })).toHaveAttribute(
        "href",
        "/communities#gdgoc-kiit",
      );
      expect(document.querySelector("a a")).toBeNull();
    },
  );
  it.each(["pending", "error"])(
    "labels incomplete result scope when the complete corpus is %s",
    (state) => {
      routeHarness.search = { type: "Workshop" };
      queryHarness.isPending = state === "pending";
      queryHarness.isError = state === "error";
      render(<EventsRouteAny.options.component />);
      expect(
        screen.getByText(
          state === "pending"
            ? /Counts below cover loaded events/
            : /previously loaded events only/,
        ),
      ).not.toHaveAttribute("role");
      // Only the count region announces; the scope caveat is static context.
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );
  it.each([
    ["skips", PAST_2020, 1, false],
    ["does not skip", [], 0, false],
    ["does not retry after a failed automatic request for", PAST_2020, 0, true],
  ])("%s a Load More page that only repeats bundled events", (_, page2, calls, failed) => {
    dataFixture.events = PAST_2020;
    infiniteHarness.hasNextPage = true;
    infiniteHarness.isFetchNextPageError = failed;
    infiniteHarness.data = {
      pages: [
        { events: [], total: 40, nextCursor: "2" },
        { events: page2.length ? page2 : [FAR_FUTURE], total: 40, nextCursor: "3" },
      ],
    };
    render(<EventsRouteAny.options.component />);
    expect(infiniteHarness.fetchNextPage).toHaveBeenCalledTimes(calls);
  });
  it.each([
    ["2026-10-14T18:29:59Z", 1],
    ["2026-10-14T18:30:00Z", 0],
  ])("ends a same-day event at IST midnight (now %s)", (now, live) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    dataFixture.events = [
      { ...PAST_2020[0], year: "2026", startDate: "2026-10-14", endDate: "2026-10-14" },
    ];
    render(<EventsRouteAny.options.component />);
    expect(screen.queryAllByText("Live")).toHaveLength(live);
    vi.useRealTimers();
  });
  it("offers archive years from the whole corpus before their pages are loaded", () => {
    infiniteHarness.data = { pages: [{ events: [], total: 40, nextCursor: "2", years: ["2017"] }] };
    render(<EventsRouteAny.options.component />);
    expect(screen.getByRole("option", { name: "2017" })).toBeInTheDocument();
  });
  it.each([false, true])(
    "keeps pagination reachable when the complete corpus fails (fetching: %s)",
    (fetching) => {
      routeHarness.search = { sort: "oldest" };
      queryHarness.isError = true;
      infiniteHarness.hasNextPage = true;
      infiniteHarness.isFetchingNextPage = fetching;
      render(<EventsRouteAny.options.component />);
      const button = screen.getByRole("button", {
        name: fetching ? "Loading…" : "Load more events",
      });
      fireEvent.click(button);
      expect(infiniteHarness.fetchNextPage).toHaveBeenCalledTimes(fetching ? 0 : 1);
    },
  );
  it("searches canonical organizer names and aliases without title matches", () => {
    dataFixture.events = [{ ...PAST_2020[0], community: "TFUG BBSR" }];
    routeHarness.search = { q: "Bhubaneswar" };
    render(<EventsRouteAny.options.component />);
    expect(screen.getByText(PAST_2020[0].title)).toBeInTheDocument();
  });
  it("preserves all other URL filters when each control changes", () => {
    routeHarness.search = { q: "Alpha", community: "gdgoc-kiit", type: "Workshop" };
    dataFixture.events = [{ ...PAST_2020[0], community: "GDGoC KIIT", type: "Workshop" }];
    render(<EventsRouteAny.options.component />);
    fireEvent.change(screen.getByPlaceholderText("Search events… [/]"), {
      target: { value: "next" },
    });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { q: "next", community: "gdgoc-kiit", type: "Workshop" },
      replace: true,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by organizer" }), {
      target: { value: "tfug-bbsr" },
    });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { q: "next", community: "tfug-bbsr", type: "Workshop" },
      replace: true,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by event type" }), {
      target: { value: "Conference" },
    });
    expect(routeHarness.navigate).toHaveBeenLastCalledWith({
      search: { q: "next", community: "tfug-bbsr", type: "Conference" },
      replace: true,
    });
  });
  it("returns to loaded-page pagination after clearing a cached full-corpus filter", () => {
    const loaded = { ...PAST_2020[0], title: "Loaded first page" };
    const hidden = { ...PAST_2020[1], title: "Hidden second page" };
    infiniteHarness.data = { pages: [{ events: [loaded], total: 2, nextCursor: "2" }] };
    infiniteHarness.hasNextPage = true;
    queryHarness.data = { events: [loaded, hidden] };
    routeHarness.search = { q: "Hidden" };
    render(<EventsRouteAny.options.component />);
    expect(screen.getByText(hidden.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(screen.getByText(loaded.title)).toBeInTheDocument();
    expect(screen.queryByText(hidden.title)).not.toBeInTheDocument();
    expect(queryHarness.lastOptions?.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(infiniteHarness.fetchNextPage).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["a partial page", { pages: [{ events: [], total: 0, partial: true }] }, {}, undefined],
    ["a partial complete corpus", undefined, { q: "x" }, { events: [], partial: true }],
  ])("warns when the events API returns %s", (_, pages, search, complete) => {
    infiniteHarness.data = pages as never;
    routeHarness.search = search;
    queryHarness.data = complete as never;
    render(<EventsRouteAny.options.component />);
    expect(
      screen.getByText(/Some event sources are incomplete or unavailable/),
    ).toBeInTheDocument();
  });
  it("restores a linkable query and searches the complete event corpus", async () => {
    const hiddenEvent: Event = {
      year: "2026",
      date: "21 Sep 2026",
      title: "Hidden Odia Search Meetup",
      url: "https://example.com/hidden-search-meetup",
      type: "Talk",
      community: "OpenOdia",
      description: "Not present in the loaded timeline pages.",
      startDate: "2026-09-21",
      endDate: "2026-09-21",
    };
    expect(EventsRouteAny.options.validateSearch({ q: hiddenEvent.title })).toEqual({
      q: hiddenEvent.title,
    });
    expect(EventsRouteAny.options.validateSearch({ q: "x".repeat(81) })).toEqual({});
    routeHarness.search = { q: hiddenEvent.title };
    queryHarness.data = { events: [hiddenEvent] };
    infiniteHarness.data = { pages: [{ events: [], total: 0 }] };
    const Component = EventsRouteAny.options.component;
    render(<Component />);

    expect(screen.getByPlaceholderText("Search events… [/]")).toHaveValue(hiddenEvent.title);
    expect(screen.getByText(hiddenEvent.title)).toBeInTheDocument();
    expect(queryHarness.lastOptions?.enabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Search events… [/]"), {
      target: { value: "next event" },
    });
    expect(screen.getByPlaceholderText("Search events… [/]")).toHaveValue("next event");
    expect(routeHarness.navigate).toHaveBeenCalledWith({
      search: { q: "next event" },
      replace: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [hiddenEvent] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(queryHarness.lastOptions?.queryFn()).resolves.toEqual({ events: [hiddenEvent] });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/events");

    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(queryHarness.lastOptions?.queryFn()).rejects.toThrow(
      "Failed to fetch complete event search corpus",
    );
  });

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
        community: "TFUG BBSR",
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
        community: "TFUG BBSR",
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
        community: "TFUG BBSR",
        description: "d",
        startDate: "2023",
      },
      {
        year: "2023",
        date: "prose without month",
        title: "Malformed Start Month",
        url: "https://example.com/malformed-2",
        type: "Talk",
        community: "TFUG BBSR",
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

  it("keeps the event-count live region mounted through the first filter and clear", () => {
    dataFixture.events = PAST_2020;
    const Component = EventsRouteAny.options.component;
    render(<Component />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(`${PAST_2020.length} events shown`);
    const community = screen.getByRole("combobox", { name: "Filter by organizer" });
    fireEvent.change(community, { target: { value: "tfug-bbsr" } });
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("2 events matched");
    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent(`${PAST_2020.length} events shown`);
    const search = screen.getByRole("searchbox", { name: "Search events" });
    fireEvent.change(search, { target: { value: "Alpha" } });
    expect(region).toHaveTextContent("1 event matched");
    fireEvent.change(search, { target: { value: "no-matching-event" } });
    expect(region).toHaveTextContent("0 events matched");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
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

    const communitySelect = screen.getByRole("combobox", { name: "Filter by organizer" });
    const typeSelect = screen.getByRole("combobox", { name: "Filter by event type" });

    fireEvent.change(communitySelect, { target: { value: "tfug-bbsr" } });
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();
    expect(screen.queryByText("Delta Hackathon")).not.toBeInTheDocument();

    fireEvent.change(communitySelect, { target: { value: "" } });
    fireEvent.change(typeSelect, { target: { value: "Conference" } });
    expect(screen.getByText("Gamma Conference")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Talk")).not.toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: "" } });
    expect(screen.getByText("Alpha Talk")).toBeInTheDocument();

    fireEvent.change(communitySelect, { target: { value: "odishaai" } });
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

  it.each([false, true])(
    "bypasses animated timeline scrolling under reduced motion with Lenis=%s",
    (withLenis) => {
      dataFixture.events = PAST_2020;
      infiniteHarness.data = { pages: [{ events: [FAR_FUTURE], total: 1 }] };
      vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      const lenisScrollTo = vi.fn();
      if (withLenis) {
        (window as unknown as { lenis?: unknown }).lenis = { scrollTo: lenisScrollTo };
      }
      const Component = EventsRouteAny.options.component;
      render(<Component />);
      clickTimelineNode("Upcoming");
      expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number), behavior: "instant" });
      expect(lenisScrollTo).not.toHaveBeenCalled();
    },
  );

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
        community: "TFUG BBSR",
        description: "desc",
      },
      {
        year: "2025",
        date: "banana",
        title: "Invalid Date Valid Year",
        url: "https://example.com/invalid-valid-year",
        type: "Talk",
        community: "TFUG BBSR",
        description: "desc",
      },
      {
        year: "abc",
        date: "banana",
        title: "Invalid Date Invalid Year",
        url: "https://example.com/invalid-invalid-year",
        type: "Talk",
        community: "TFUG BBSR",
        description: "desc",
      },
      {
        year: "",
        date: "banana",
        title: "Invalid Date No Year",
        url: "https://example.com/invalid-no-year",
        type: "Talk",
        community: "TFUG BBSR",
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
    dataFixture.events = PAST_2020;
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
  it("rejects an invalid source date instead of inventing calendar metadata", async () => {
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
    expect(events).toEqual([]);
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

  it("keeps RSS retryable on total failure without retained events, while successful-empty stays available", async () => {
    dataFixture.events = [];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    const failed = await eventsFeedGet();
    expect(failed.status).toBe(503);
    expect(failed.headers.get("X-OpenOdia-Partial")).toBe("true");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { prerenderData: { upcomingEvents: { results: [], count: 0 }, pastEvents: { results: [], count: 0 } } } } })}</script>`,
    } as Response);
    const empty = await eventsFeedGet();
    expect(empty.status).toBe(200);
    expect(empty.headers.get("X-OpenOdia-Partial")).toBe("false");
    const api = await apiEventsGet(new Request("https://openodia.com/api/events"));
    expect(api.status).toBe(200);
    expect((await api.json()).partial).toBe(false);
  });

  it("returns a retryable unavailable response on total failure without retained events", async () => {
    dataFixture.events = [];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    const response = await apiEventsGet(new Request("https://openodia.com/api/events"));
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.events).toEqual([]);
    expect(data.partial).toBe(true);
    expect(data.sources.every((source: { outcome: string }) => source.outcome === "failed")).toBe(
      true,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 500 when dedupe throws during live event ingestion", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    (mergeEventCollectionsByUrl as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("canonical merge boom");
    });

    const response = await apiEventsGet(new Request("https://openodia.com/api/events"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ events: [], partial: true, sources: [] });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Live events ingestion error");
  });

  it("falls back to a default event type when Bevy data omits it", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          prerenderData: {
            upcomingEvents: { results: [] },
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
