import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORGANIZERS } from "../src/data/organizers";
import { filterOrganizers, validateDirectorySearch } from "../src/lib/organizer-directory";
import { Route as CommunitiesRoute } from "../src/routes/communities";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
CommunitiesRoute.update({
  id: "/communities",
  path: "/communities",
  getParentRoute: () => rootRoute,
} as never);
const routeTree = rootRoute.addChildren([CommunitiesRoute]);

async function renderAt(url: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
}

function cardNames(): string[] {
  return screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
}

function kindChip(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "Organizer kind" })).getByRole("button", {
    name,
  });
}

describe("organizer directory search", () => {
  it("keeps valid URL params and drops blank, oversized, and unknown ones", () => {
    expect(validateDirectorySearch({ q: "gdg", kind: "institution" })).toEqual({
      q: "gdg",
      kind: "institution",
    });
    expect(validateDirectorySearch({ q: "   ", kind: "not-a-kind" })).toEqual({});
    expect(validateDirectorySearch({ q: "x".repeat(81), kind: 3 })).toEqual({});
  });

  it("matches canonical names, aliases, regions, descriptions, and kind labels", () => {
    const ids = (q: string) => filterOrganizers({ q }).map((o) => o.id);
    expect(ids("TFUG BBSR")).toEqual(["tfug-bbsr"]);
    expect(ids("ocac")).toEqual(["odisha-eit"]);
    expect(ids("cuttack")).toEqual(["ravenshaw-university"]);
    expect(ids("incubation")).toEqual(["startup-odisha"]);
    expect(ids("government")).toContain("odisha-eit");
    expect(filterOrganizers({})).toHaveLength(ORGANIZERS.length);
  });

  it("composes the query with the kind filter", () => {
    const campus = filterOrganizers({ kind: "student-community" });
    expect(campus.length).toBeGreaterThan(1);
    expect(campus.every((o) => o.kind === "student-community")).toBe(true);
    expect(filterOrganizers({ q: "kiit", kind: "student-community" }).map((o) => o.id)).toEqual([
      "gdgoc-kiit",
    ]);
    expect(filterOrganizers({ q: "kiit", kind: "government" })).toEqual([]);
  });
});

describe("/communities route", () => {
  // jsdom has no scrollTo; the router calls it to restore scroll on navigation.
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("server-renders organizer cards, official links, and the independence notice", async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/communities"] }),
    });
    await router.load();
    const html = renderToString(<RouterProvider router={router} />);
    for (const organizer of ORGANIZERS) {
      expect(html).toContain(`id="${organizer.id}"`);
    }
    expect(html).toContain("https://www.odishaai.org/");
    expect(html).toContain("does not mean it is part of or endorsed");
  });

  it("restores the query and kind filter from the URL on load", async () => {
    await renderAt("/communities?q=kiit&kind=student-community");
    expect(screen.getByRole("searchbox", { name: /search communities/i })).toHaveValue("kiit");
    expect(kindChip("Campus chapters")).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["GDGoC KIIT"]);
  });

  it("ignores an unknown kind instead of selecting a different one", async () => {
    await renderAt("/communities?kind=not-a-kind");
    expect(kindChip("All kinds")).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toHaveLength(ORGANIZERS.length);
  });

  it("writes query and kind changes back to the URL without resetting each other", async () => {
    const router = await renderAt("/communities");

    await act(async () => {
      fireEvent.click(kindChip("Institutions"));
    });
    expect(router.state.location.search).toEqual({ kind: "institution" });

    await act(async () => {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cuttack" } });
    });
    expect(router.state.location.search).toEqual({ kind: "institution", q: "cuttack" });
    expect(router.state.location.searchStr).toBe("?q=cuttack&kind=institution");
    expect(cardNames()).toEqual(["Ravenshaw University"]);

    await act(async () => {
      fireEvent.click(kindChip("Institutions"));
    });
    expect(router.state.location.search).toEqual({ q: "cuttack" });

    await act(async () => {
      fireEvent.click(kindChip("Government"));
    });
    await act(async () => {
      fireEvent.click(kindChip("All kinds"));
    });
    expect(router.state.location.search).toEqual({ q: "cuttack" });
    expect(kindChip("All kinds")).toHaveAttribute("aria-pressed", "true");
  });

  it("follows URL changes from links and browser history after load", async () => {
    const router = await renderAt("/communities");
    await act(async () => {
      await router.navigate({ to: "/communities", search: { q: "ocac" } });
    });
    expect(screen.getByRole("searchbox")).toHaveValue("ocac");
    expect(cardNames()).toEqual(["Odisha E&IT / OCAC"]);

    await act(async () => {
      router.history.back();
    });
    await screen.findByText(`${ORGANIZERS.length} organizers listed`);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("bounds the query and clears it from the URL", async () => {
    const router = await renderAt("/communities?q=gdg");
    await act(async () => {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "g".repeat(120) } });
    });
    expect(router.state.location.search).toEqual({ q: "g".repeat(80) });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    });
    expect(router.state.location.search).toEqual({});
  });

  it("shows an empty state whose reset clears every filter", async () => {
    const router = await renderAt("/communities?q=kiit&kind=government");
    expect(cardNames()).toEqual([]);
    expect(screen.getByText("No organizers match these filters.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    });
    expect(router.state.location.search).toEqual({});
    expect(cardNames()).toHaveLength(ORGANIZERS.length);
  });
});
