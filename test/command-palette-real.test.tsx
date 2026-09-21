import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerHarness = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => routerHarness.navigate }));

import CommandPaletteDialog from "../src/components/CommandPaletteDialog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function searchResponse(results: unknown[], partial = false) {
  return new Response(
    JSON.stringify({
      results,
      partial,
      sources: partial
        ? [
            { source: "catalog", status: "ready", count: results.length },
            { source: "videos", status: "unavailable", count: 0 },
          ]
        : [{ source: "fixture", status: "ready", count: results.length }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  routerHarness.navigate.mockClear();
});

describe("real command palette primitives", () => {
  it("does not call the search API for a one-character query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />, { wrapper });

    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "o" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Type at least 2 characters");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves service order, announces partial results, and keyboard-selects an internal result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        searchResponse(
          [
            {
              id: "model:atlas",
              kind: "model",
              title: "Odia OCR Atlas",
              summary: "Exact model match",
              href: "/r/model/openodia/atlas",
              source: "catalog",
              score: 40000,
            },
            {
              id: "repository:atlas",
              kind: "repository",
              title: "Atlas examples",
              summary: "Lower-ranked repository",
              href: "/r/gh/openodia/atlas-examples",
              source: "catalog",
              score: 12000,
            },
          ],
          true,
        ),
      ),
    );
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />, { wrapper });

    const input = screen.getByPlaceholderText("Search all OpenOdia resources…");
    fireEvent.change(input, { target: { value: "atlas" } });
    await screen.findByText("Odia OCR Atlas");
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/Partial results/);

    const exact = screen.getByText("Odia OCR Atlas");
    const lowerRanked = screen.getByText("Atlas examples");
    expect(
      exact.compareDocumentPosition(lowerRanked) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(routerHarness.navigate).toHaveBeenCalledWith({
        to: "/r/gh/openodia/atlas-examples",
      }),
    );
  });

  it("opens external-only results safely", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        searchResponse([
          {
            id: "tool:external",
            kind: "tool",
            title: "External Odia Keyboard",
            summary: "External-only tool",
            externalHref: "https://example.com/keyboard",
            source: "catalog",
            score: 40000,
          },
        ]),
      ),
    );
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />, { wrapper });
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "keyboard" },
    });
    fireEvent.click(await screen.findByText("External Odia Keyboard"));
    expect(open).toHaveBeenCalledWith("https://example.com/keyboard", "_blank", "noreferrer");
  });

  it("renders page, tutorial, and event results and navigates a returned page", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        searchResponse([
          {
            id: "page:/learn",
            kind: "page",
            title: "Learning hub",
            summary: "Start here",
            href: "/learn",
            source: "pages",
            score: 40000,
          },
          {
            id: "tutorial:one",
            kind: "tutorial",
            title: "Learn Odia AI",
            summary: "First tutorial",
            href: "/tutorials?q=learn",
            source: "videos",
            score: 30000,
          },
          {
            id: "tutorial:two",
            kind: "tutorial",
            title: "Learn Odia NLP",
            summary: "Second tutorial",
            href: "/tutorials?q=nlp",
            source: "videos",
            score: 29000,
          },
          {
            id: "event:learn",
            kind: "event",
            title: "Learning meetup",
            summary: "Community event",
            href: "/events?q=learn",
            source: "events",
            score: 28000,
          },
        ]),
      ),
    );
    render(<CommandPaletteDialog open onOpenChange={close} />, { wrapper });
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "learn" },
    });

    expect(await screen.findByText("Learn Odia AI")).toBeInTheDocument();
    expect(screen.getByText("Learn Odia NLP")).toBeInTheDocument();
    expect(screen.getByText("Learning meetup")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Learning hub"));
    expect(close).toHaveBeenCalledWith(false);
    expect(routerHarness.navigate).toHaveBeenCalledWith({ to: "/learn" });
  });

  it("shows the retry state when the search endpoint rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />, { wrapper });
    fireEvent.change(screen.getByPlaceholderText("Search all OpenOdia resources…"), {
      target: { value: "offline" },
    });
    expect(await screen.findByRole("alert", {}, { timeout: 3_000 })).toHaveTextContent(
      "temporarily unavailable",
    );
  });

  it("aborts a superseded request and never renders its stale result", async () => {
    type Pending = {
      query: string;
      signal?: AbortSignal;
      resolve: (response: Response) => void;
    };
    const pending: Pending[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            pending.push({ query: String(input), signal: init?.signal ?? undefined, resolve });
          }),
      ),
    );
    render(<CommandPaletteDialog open onOpenChange={() => undefined} />, { wrapper });
    const input = screen.getByPlaceholderText("Search all OpenOdia resources…");

    fireEvent.change(input, { target: { value: "oldquery" } });
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.change(input, { target: { value: "newquery" } });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].signal?.aborted).toBe(true);

    pending[1].resolve(
      searchResponse([
        {
          id: "paper:new",
          kind: "paper",
          title: "New query result",
          summary: "Current result",
          href: "/papers?q=newquery",
          source: "papers",
          score: 40000,
        },
      ]),
    );
    expect(await screen.findByText("New query result")).toBeInTheDocument();

    pending[0].resolve(
      searchResponse([
        {
          id: "paper:old",
          kind: "paper",
          title: "Stale old result",
          summary: "Should never render",
          href: "/papers?q=oldquery",
          source: "papers",
          score: 40000,
        },
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Stale old result")).not.toBeInTheDocument();
  });
});
