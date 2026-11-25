import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../src/data/events/types";

const dataFixture = vi.hoisted(() => ({ events: [] as Event[] }));

const infiniteHarness = vi.hoisted(() => ({
  data: undefined as { pages: { events: Event[]; total: number }[] } | undefined,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useInfiniteQuery: () => infiniteHarness,
  };
});

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

import { Route as EventsRoute } from "../src/routes/events";

const EventsComponent = (EventsRoute as unknown as { options: { component: ComponentType } })
  .options.component;

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
];

const originalFetch = globalThis.fetch;

function liveRegions(root: ParentNode = document) {
  return Array.from(
    new Set([
      ...root.querySelectorAll(
        '[role="status"], [role="alert"], [role="log"], [role="marquee"], [role="timer"]',
      ),
      ...root.querySelectorAll('[aria-live]:not([aria-live="off"])'),
    ]),
  );
}

describe("events complete-corpus refetch", () => {
  beforeEach(() => {
    dataFixture.events = PAST_2020;
    routeHarness.search = { type: "Workshop" };
    routeHarness.navigate.mockClear();
    infiniteHarness.data = undefined;
    infiniteHarness.hasNextPage = false;
    infiniteHarness.isFetchingNextPage = false;
    infiniteHarness.isFetchNextPageError = false;
    infiniteHarness.fetchNextPage.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("keeps complete-corpus live-region wording after a failed refetch that retains data", async () => {
    let failComplete = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/events") && !url.includes("?")) {
        if (failComplete) {
          throw new Error("refetch failed");
        }
        return new Response(JSON.stringify({ events: PAST_2020 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <EventsComponent />
      </QueryClientProvider>,
    );
    const region = await screen.findByRole("status");
    await waitFor(() => {
      expect(region.textContent).toBe("1 event matched");
    });
    failComplete = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["allLiveEventsForFilter"] }).catch(() => undefined);
    });
    await waitFor(() => {
      const state = client.getQueryState(["allLiveEventsForFilter"]);
      expect(state?.status).toBe("error");
      expect(state?.fetchStatus).toBe("idle");
      expect(state?.data).toEqual({ events: PAST_2020 });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(liveRegions()).toEqual([region]);
    expect(region.textContent).toBe("1 event matched");
    expect(screen.queryByText(/previously loaded events only/)).not.toBeInTheDocument();
  });
});
