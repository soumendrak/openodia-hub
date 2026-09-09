import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeHarness = vi.hoisted(() => ({
  loaderData: undefined as unknown,
}));

const queryHarness = vi.hoisted(() => ({
  data: undefined as unknown,
  queryFn: undefined as (() => Promise<unknown>) | undefined,
}));

const sourcesHarness = vi.hoisted(() => ({
  awesome: vi.fn(),
  repos: vi.fn(),
  models: vi.fn(),
  datasets: vi.fn(),
}));

const sitemapHarness = vi.hoisted(() => ({
  catalog: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const makeRoute = (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => routeHarness.loaderData,
  });
  const Link = ({
    children,
    to,
    className,
  }: {
    children?: React.ReactNode;
    to?: string;
    className?: string;
  }) => React.createElement("a", { href: to, className }, children);

  return {
    createFileRoute: () => (options: Record<string, unknown>) => makeRoute(options),
    Link,
  };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    queryHarness.queryFn = options.queryFn;
    return { data: queryHarness.data };
  },
}));

vi.mock("../src/lib/fetch-utils", () => ({
  withDeadline: (promise: Promise<unknown>) => promise,
}));
vi.mock("../src/lib/sources/awesome", () => ({ loadAwesome: sourcesHarness.awesome }));
vi.mock("../src/lib/sources/repos", () => ({ loadRepos: sourcesHarness.repos }));
vi.mock("../src/lib/sources/huggingface", () => ({
  loadModels: sourcesHarness.models,
  loadDatasets: sourcesHarness.datasets,
}));
vi.mock("../src/lib/sources/catalog", () => ({ loadCatalog: sitemapHarness.catalog }));

vi.mock("../src/components/ContributorGrid", () => ({ ContributorGrid: () => null }));
vi.mock("../src/components/ContributorLeaderboard", () => ({
  ContributorLeaderboard: () => null,
}));

type RouteOptions = Record<string, unknown>;
type RouteModule = { Route: { options: RouteOptions } };
type ServerRouteModule = {
  Route: { options: { server: { handlers: { GET: () => Promise<Response> } } } };
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  routeHarness.loaderData = undefined;
  queryHarness.data = undefined;
  queryHarness.queryFn = undefined;
});

describe("home route: ecosystem stats loader and head metadata", () => {
  it("computes ecosystem stats across null, partial, and populated sources", async () => {
    const mod = (await import("../src/routes/index")) as unknown as RouteModule;
    const loader = mod.Route.options.loader as () => Promise<unknown>;

    sourcesHarness.awesome.mockResolvedValueOnce(null);
    sourcesHarness.repos.mockResolvedValueOnce(null);
    sourcesHarness.models.mockResolvedValueOnce(null);
    sourcesHarness.datasets.mockResolvedValueOnce(null);
    await expect(loader()).resolves.toEqual({
      projects: null,
      models: { value: null, approx: false },
      datasets: { value: null, approx: false },
    });

    sourcesHarness.awesome.mockResolvedValueOnce(null);
    sourcesHarness.repos.mockResolvedValueOnce(["a", "b", "c"]);
    sourcesHarness.models.mockResolvedValueOnce({ items: [1, 2], truncated: true });
    sourcesHarness.datasets.mockResolvedValueOnce(null);
    await expect(loader()).resolves.toEqual({
      projects: 3,
      models: { value: 2, approx: true },
      datasets: { value: null, approx: false },
    });

    sourcesHarness.awesome.mockResolvedValueOnce(["x"]);
    sourcesHarness.repos.mockResolvedValueOnce(null);
    sourcesHarness.models.mockResolvedValueOnce(null);
    sourcesHarness.datasets.mockResolvedValueOnce({ items: [1, 2, 3], truncated: false });
    await expect(loader()).resolves.toEqual({
      projects: 1,
      models: { value: null, approx: false },
      datasets: { value: 3, approx: false },
    });
  });

  it("builds head metadata for the home, about, contribute, and API-docs routes", async () => {
    const home = (await import("../src/routes/index")) as unknown as RouteModule;
    expect((home.Route.options.head as () => { meta: unknown[] })().meta.length).toBeGreaterThan(0);

    const about = (await import("../src/routes/about")) as unknown as RouteModule;
    expect(
      (about.Route.options.head as () => { scripts: unknown[] })().scripts.length,
    ).toBeGreaterThan(0);

    const contribute = (await import("../src/routes/contribute")) as unknown as RouteModule;
    expect(
      (contribute.Route.options.head as () => { meta: unknown[] })().meta.length,
    ).toBeGreaterThan(0);

    const api = (await import("../src/routes/api/index")) as unknown as RouteModule;
    expect((api.Route.options.head as () => { meta: unknown[] })().meta.length).toBeGreaterThan(0);
  });
});

describe("API docs route: Scalar bundle script reuse", () => {
  it("only appends the Scalar bundle script once across renders", async () => {
    const mod = (await import("../src/routes/api/index")) as unknown as RouteModule;
    const Component = mod.Route.options.component as ComponentType;

    const first = render(<Component />);
    expect(document.getElementById("scalar-bundle")).not.toBeNull();
    first.unmount();

    // A second mount finds the bundle script already on the page and skips
    // appending a duplicate.
    render(<Component />);
    expect(document.querySelectorAll("#scalar-bundle")).toHaveLength(1);
  });
});

describe("home route: community videos and FAQ schema", () => {
  it("falls back to featured videos, renders the real FAQ list, and exercises both fetch outcomes", async () => {
    const mod = (await import("../src/routes/index")) as unknown as RouteModule;
    const Component = mod.Route.options.component as ComponentType;

    routeHarness.loaderData = {
      projects: 5,
      models: { value: 1, approx: false },
      datasets: { value: 1, approx: false },
    };
    queryHarness.data = undefined;

    render(<Component />);
    expect(
      screen.getByText(/Tutorial: GenAI and LLM Overview by Dr\. Shantipriya Parida/),
    ).toBeInTheDocument();
    expect(screen.getByText("What is OpenOdia?")).toBeInTheDocument();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })));
    await expect(queryHarness.queryFn?.()).rejects.toThrow("videos");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            channels: [
              { name: "OpenOdia", videos: [{ id: "z", title: "Z", published: "2026-01-01" }] },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(queryHarness.queryFn?.()).resolves.toEqual({
      channels: [{ name: "OpenOdia", videos: [{ id: "z", title: "Z", published: "2026-01-01" }] }],
    });

    cleanup();

    queryHarness.data = {
      channels: [
        {
          name: "Chan",
          videos: [
            { id: "v1", title: "T1", published: "2026-01-03" },
            { id: "v2", title: "T2", published: "2026-01-02" },
            { id: "v3", title: "T3" },
          ],
        },
      ],
    };
    render(<Component />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();

    cleanup();

    // Both entries lack `published`, so the sort comparator's `?? ""` fallback
    // runs on both sides of the comparison in the same call.
    queryHarness.data = {
      channels: [
        {
          name: "Chan",
          videos: [
            { id: "v4", title: "T4" },
            { id: "v5", title: "T5" },
          ],
        },
      ],
    };
    render(<Component />);
    expect(
      screen.getByText(/Tutorial: GenAI and LLM Overview by Dr\. Shantipriya Parida/),
    ).toBeInTheDocument();
  });
});

describe("contribute route: copy-to-clipboard success and failure", () => {
  it("copies the template, resets after the timeout, and tolerates a rejected write", async () => {
    const mod = (await import("../src/routes/contribute")) as unknown as RouteModule;
    const Component = mod.Route.options.component as ComponentType;

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<Component />);
    const copyButton = screen.getByRole("button", { name: "Copy" });

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalled();
    expect(screen.getByText("Copied")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    vi.useRealTimers();

    writeText.mockRejectedValueOnce(new Error("denied"));
    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });
});

describe("sitemap.xml route: resource entry edge cases", () => {
  it("omits lastmod for undated resources", async () => {
    const mod = (await import("../src/routes/sitemap.xml")) as unknown as ServerRouteModule;
    sitemapHarness.catalog.mockResolvedValueOnce([{ permalink: "/r/model/no-date" }]);

    const response = await mod.Route.options.server.handlers.GET();
    const body = await response.text();

    expect(body).toContain("https://openodia.com/r/model/no-date");
    expect(body).not.toContain("<lastmod>");
  });

  it("caps resource entries at the configured maximum and stops emitting further URLs", async () => {
    const mod = (await import("../src/routes/sitemap.xml")) as unknown as ServerRouteModule;
    const big = Array.from({ length: 20001 }, (_, i) => ({ permalink: `/r/gen/${i}` }));
    sitemapHarness.catalog.mockResolvedValueOnce(big);

    const response = await mod.Route.options.server.handlers.GET();
    const body = await response.text();

    expect(body).toContain("https://openodia.com/r/gen/19999");
    expect(body).not.toContain("https://openodia.com/r/gen/20000");
  }, 20000);
});

describe("static data: contributors", () => {
  it("exposes a non-empty contributors list", async () => {
    const { CONTRIBUTORS } = await import("../src/data/contributors");
    expect(CONTRIBUTORS.length).toBeGreaterThan(0);
    expect(CONTRIBUTORS[0]).toMatchObject({
      login: expect.any(String),
      name: expect.any(String),
      avatar_url: expect.any(String),
      github_url: expect.any(String),
      projects: expect.any(String),
    });
  });
});
