import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Focused coverage for the three routes that route-rendering.test.tsx only
 * exercises on the happy path: treebank search (filters, pagination, and the
 * search-param validator/loader), tutorials (skeleton loading state and the
 * search filter), and the r/$ resource detail loader (not-found and error
 * branches).
 */

const routeHarness = vi.hoisted(() => ({
  loaderData: {} as Record<string, unknown>,
  search: {} as Record<string, Record<string, unknown>>,
  navigate: vi.fn((opts?: { search?: (prev: Record<string, unknown>) => unknown }) => {
    if (typeof opts?.search === "function") {
      return opts.search(routeHarness.search["/treebank"] ?? {});
    }
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const makeRoute = (path: string, options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => routeHarness.loaderData[path],
    useSearch: () => routeHarness.search[path] ?? {},
    useNavigate: () => routeHarness.navigate,
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
    createFileRoute: (path: string) => (options: Record<string, unknown>) =>
      makeRoute(path, options),
    Link,
    notFound: () => new Error("not found"),
  };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((input: unknown) => unknown) | undefined;
    const builder = {
      inputValidator: (fn: (input: unknown) => unknown) => {
        validator = fn;
        return builder;
      },
      handler: (fn: (ctx: { data: unknown }) => unknown) => {
        return (ctx?: { data: unknown }) => {
          const data = validator ? validator(ctx?.data) : ctx?.data;
          return fn({ data });
        };
      },
    };
    return builder;
  },
}));

const treebankMocks = vi.hoisted(() => ({ loadTreebank: vi.fn() }));
vi.mock("../src/lib/sources/treebank", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/sources/treebank")>(
    "../src/lib/sources/treebank",
  );
  return { ...actual, loadTreebank: treebankMocks.loadTreebank };
});

const videosMocks = vi.hoisted(() => ({ loadVideos: vi.fn() }));
vi.mock("../src/lib/sources/videos", () => ({ loadVideos: videosMocks.loadVideos }));

const resourceMocks = vi.hoisted(() => ({ loadResource: vi.fn() }));
vi.mock("../src/lib/sources/resource", () => ({ loadResource: resourceMocks.loadResource }));

const previewMocks = vi.hoisted(() => ({ loadDatasetPreview: vi.fn() }));
vi.mock("../src/lib/sources/preview", () => ({
  loadDatasetPreview: previewMocks.loadDatasetPreview,
}));

const catalogMocks = vi.hoisted(() => ({ loadCatalog: vi.fn() }));
vi.mock("../src/lib/sources/catalog", () => ({ loadCatalog: catalogMocks.loadCatalog }));

vi.mock("../src/lib/sources/catalogs", () => ({
  CATALOG_SOURCES: {
    "example-catalog": { name: "Example Catalog", url: "https://example.com/catalog" },
  },
}));

vi.mock("../src/components/ResourceMeta", () => ({
  ResourceMeta: () => null,
  LicenseBadge: ({ spdx }: { spdx?: string }) => <span>{spdx}</span>,
}));

vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  breadcrumbSchema: () => ({}),
  videoListSchema: () => ({}),
}));

type RouteModule = { Route: { options: Record<string, unknown> } };

async function loadRoute(importer: () => Promise<unknown>) {
  const module = (await importer()) as RouteModule;
  return module.Route.options as {
    validateSearch?: (search: Record<string, unknown>) => unknown;
    loaderDeps?: (ctx: { search: Record<string, unknown> }) => unknown;
    loader: (ctx: unknown) => unknown;
    head: (ctx?: unknown) => { meta?: unknown[]; links?: unknown[] };
    component: ComponentType;
  };
}

function renderComponent(Component: ComponentType) {
  const view = render(<Component />);
  expect(view.container.firstChild).not.toBeNull();
  return view;
}

afterEach(() => {
  cleanup();
  routeHarness.navigate.mockClear();
  routeHarness.loaderData = {};
  routeHarness.search = {};
  vi.clearAllMocks();
});

const corpus = {
  sentences: [
    {
      sentId: "s1",
      text: "ଓଡ଼ିଆ ଭାଷା",
      translit: "odia bhasa",
      textEn: "Odia language",
      tokens: [
        {
          id: 1,
          form: "ଓଡ଼ିଆ",
          upos: "NOUN",
          xpos: "NN",
          feats: "Case=Nom",
          head: 0,
          deprel: "root",
          translit: "odia",
        },
        {
          id: 2,
          form: "ଭାଷା",
          upos: "NOUN",
          xpos: "NN",
          feats: "",
          head: 1,
          deprel: "obj",
          translit: "bhasa",
        },
      ],
    },
  ],
  tokenCount: 2,
};

describe("treebank route", () => {
  it("normalises search params, drops empty values, and caps length", async () => {
    const { validateSearch } = await loadRoute(() => import("../src/routes/treebank"));
    expect(validateSearch?.({})).toEqual({ q: undefined, upos: undefined, deprel: undefined });
    expect(validateSearch?.({ q: "   ", upos: "", deprel: 123 })).toEqual({
      q: undefined,
      upos: undefined,
      deprel: undefined,
    });
    expect(validateSearch?.({ q: "a".repeat(100), upos: "b".repeat(30), deprel: "root" })).toEqual({
      q: "a".repeat(80),
      upos: "b".repeat(20),
      deprel: "root",
    });
  });

  it("defaults loaderDeps when search params are absent", async () => {
    const { loaderDeps } = await loadRoute(() => import("../src/routes/treebank"));
    expect(loaderDeps?.({ search: {} })).toEqual({ q: "", upos: "", deprel: "" });
    expect(loaderDeps?.({ search: { q: "x", upos: "y", deprel: "z" } })).toEqual({
      q: "x",
      upos: "y",
      deprel: "z",
    });
  });

  it("returns search results on success and a failure flag when the loader throws", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/treebank"));
    treebankMocks.loadTreebank.mockResolvedValueOnce(corpus);
    const ok = (await loader({ deps: { q: "", upos: "", deprel: "" } })) as {
      failed: boolean;
      result: { hits: unknown[] };
    };
    expect(ok.failed).toBe(false);
    expect(ok.result.hits.length).toBe(1);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    treebankMocks.loadTreebank.mockRejectedValueOnce(new Error("upstream down"));
    const failed = (await loader({ deps: { q: "", upos: "", deprel: "" } })) as {
      failed: boolean;
      result: { hits: unknown[] };
    };
    expect(failed.failed).toBe(true);
    expect(failed.result.hits).toEqual([]);
  });

  it("builds page head metadata", async () => {
    const { head } = await loadRoute(() => import("../src/routes/treebank"));
    const result = head();
    expect(result.meta?.length).toBeGreaterThan(0);
  });

  it("updates the query and toggles upos/deprel chips", async () => {
    const { component: Treebank } = await loadRoute(() => import("../src/routes/treebank"));
    treebankMocks.loadTreebank.mockResolvedValueOnce(corpus);
    const { searchTreebank } = await vi.importActual<typeof import("../src/lib/sources/treebank")>(
      "../src/lib/sources/treebank",
    );
    const result = searchTreebank(corpus, { q: "", upos: "", deprel: "", limit: 25 });

    routeHarness.search["/treebank"] = { q: "", upos: "", deprel: "" };
    routeHarness.loaderData["/treebank"] = { result, failed: false };
    renderComponent(Treebank);

    fireEvent.change(screen.getByPlaceholderText(/word, transliteration/i), {
      target: { value: "ଭାଷା" },
    });
    expect(routeHarness.navigate).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText("Any")[0]);
    fireEvent.click(screen.getByRole("button", { name: /NOUN/ }));
    fireEvent.click(screen.getAllByText("Any")[1]);
    fireEvent.click(screen.getByRole("button", { name: /root/ }));
    expect(routeHarness.navigate).toHaveBeenCalledTimes(5);
    routeHarness.navigate.mockClear();
    cleanup();

    routeHarness.search["/treebank"] = { q: "", upos: "NOUN", deprel: "root" };
    routeHarness.loaderData["/treebank"] = { result, failed: false };
    renderComponent(Treebank);
    fireEvent.click(screen.getByRole("button", { name: /NOUN/ }));
    fireEvent.click(screen.getByRole("button", { name: /root/ }));
    expect(routeHarness.navigate).toHaveBeenCalledTimes(2);
  });

  it("falls back to empty search params when the route search is bare", async () => {
    const { component: Treebank } = await loadRoute(() => import("../src/routes/treebank"));
    const { searchTreebank } = await vi.importActual<typeof import("../src/lib/sources/treebank")>(
      "../src/lib/sources/treebank",
    );
    const result = searchTreebank(corpus, { q: "", upos: "", deprel: "", limit: 25 });

    routeHarness.search["/treebank"] = {};
    routeHarness.loaderData["/treebank"] = { result, failed: false };
    renderComponent(Treebank);
    expect(screen.getByPlaceholderText(/word, transliteration/i)).toHaveValue("");
  });

  it("shows an empty state when nothing matches and pluralises/truncates large result counts", async () => {
    const { component: Treebank } = await loadRoute(() => import("../src/routes/treebank"));
    const { searchTreebank } = await vi.importActual<typeof import("../src/lib/sources/treebank")>(
      "../src/lib/sources/treebank",
    );

    const noMatch = searchTreebank(corpus, {
      q: "no-such-word",
      upos: "",
      deprel: "",
      limit: 25,
    });
    routeHarness.search["/treebank"] = { q: "no-such-word" };
    routeHarness.loaderData["/treebank"] = { result: noMatch, failed: false };
    renderComponent(Treebank);
    expect(screen.getByText(/Nothing matched/i)).toBeInTheDocument();
    cleanup();

    const bigCorpus = {
      sentences: Array.from({ length: 30 }, (_, i) => ({
        sentId: `s${i}`,
        text: "ଓଡ଼ିଆ",
        translit: "odia",
        textEn: "",
        tokens: [
          {
            id: 1,
            form: "ଓଡ଼ିଆ",
            upos: "NOUN",
            xpos: "NN",
            feats: "",
            head: 0,
            deprel: "root",
            translit: "odia",
          },
        ],
      })),
      tokenCount: 30,
    };
    const many = searchTreebank(bigCorpus, { q: "", upos: "NOUN", deprel: "", limit: 25 });
    expect(many.total).toBe(30);
    routeHarness.search["/treebank"] = { upos: "NOUN" };
    routeHarness.loaderData["/treebank"] = { result: many, failed: false };
    renderComponent(Treebank);
    expect(screen.getByText(/30 matching sentences/)).toBeInTheDocument();
    expect(screen.getByText(/showing the first 25/)).toBeInTheDocument();
  });
});

const oneChannel = [
  {
    handle: "@a",
    name: "Channel A",
    url: "https://youtube.com/@a",
    videos: [
      {
        id: "v1",
        title: "Big Views Video",
        published: "2025-01-01",
        thumbnail: "t1.jpg",
        channelName: "Channel A",
        channelHandle: "@a",
        channelUrl: "https://youtube.com/@a",
        viewCount: 2_500_000,
      },
      {
        id: "v2",
        title: "Mid Views Video",
        published: "2025-01-02",
        thumbnail: "t2.jpg",
        channelName: "Channel A",
        channelHandle: "@a",
        channelUrl: "https://youtube.com/@a",
        viewCount: 5_000,
      },
      {
        id: "v3",
        title: "Low Views Video",
        published: "2025-01-03",
        thumbnail: "t3.jpg",
        channelName: "Channel A",
        channelHandle: "@a",
        channelUrl: "https://youtube.com/@a",
        viewCount: 50,
      },
    ],
    playlists: [
      { id: "p1", title: "Lessons", description: "Learn Odia", thumbnail: "pl.jpg", itemCount: 3 },
      { id: "p2", title: "No Thumbnail Playlist", description: "", thumbnail: "", itemCount: 1 },
    ],
  },
  {
    handle: "@empty",
    name: "Empty Channel",
    url: "https://youtube.com/@empty",
    videos: [],
    playlists: [],
  },
];

describe("tutorials route", () => {
  it("returns loaded channels on success and an empty list on failure", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/tutorials"));
    videosMocks.loadVideos.mockResolvedValueOnce(oneChannel);
    const ok = (await loader(undefined)) as { channels: unknown[] };
    expect(ok.channels.length).toBe(2);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    videosMocks.loadVideos.mockRejectedValueOnce(new Error("down"));
    const failed = (await loader(undefined)) as { channels: unknown[] };
    expect(failed.channels).toEqual([]);
  });

  it("builds page head metadata", async () => {
    const { head } = await loadRoute(() => import("../src/routes/tutorials"));
    const result = head();
    expect(result.meta?.length).toBeGreaterThan(0);
  });

  it("renders a skeleton while there are no channels yet", async () => {
    const { component: Tutorials } = await loadRoute(() => import("../src/routes/tutorials"));
    routeHarness.loaderData["/tutorials"] = { channels: [] };
    renderComponent(Tutorials);
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("hides an empty channel and formats view counts by magnitude", async () => {
    const { component: Tutorials } = await loadRoute(() => import("../src/routes/tutorials"));
    routeHarness.loaderData["/tutorials"] = { channels: oneChannel };
    renderComponent(Tutorials);
    expect(screen.getByText("Channel A")).toBeInTheDocument();
    expect(screen.queryByText("Empty Channel")).not.toBeInTheDocument();
    expect(screen.getByText("2.5M views")).toBeInTheDocument();
    expect(screen.getByText("5K views")).toBeInTheDocument();
    expect(screen.getByText("50 views")).toBeInTheDocument();
    expect(screen.getByText("Lessons")).toBeInTheDocument();
    expect(screen.getByText("No Thumbnail Playlist")).toBeInTheDocument();
  });

  it("filters videos by title, channel name, and handle, and clears the query", async () => {
    const { component: Tutorials } = await loadRoute(() => import("../src/routes/tutorials"));
    routeHarness.loaderData["/tutorials"] = { channels: oneChannel };
    renderComponent(Tutorials);
    const input = screen.getByPlaceholderText(/Search videos/i);

    fireEvent.change(input, { target: { value: "Big Views" } });
    expect(screen.getByText(/1 video for/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Channel A" } });
    expect(screen.getByText(/3 videos for/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "@a" } });
    expect(screen.getByText(/3 videos for/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "nothing matches this" } });
    expect(screen.getByText("No videos matched.")).toBeInTheDocument();

    const clearButton = document.querySelector("button");
    expect(clearButton).not.toBeNull();
    fireEvent.click(clearButton as Element);
    expect((input as HTMLInputElement).value).toBe("");
  });
});

const datasetResource = {
  kind: "dataset" as const,
  id: "openodia/data",
  name: "data",
  author: "openodia",
  url: "https://huggingface.co/datasets/openodia/data",
  description: "A dataset description.",
  license: "CC-BY-4.0",
  topic: "translation",
  downloads: 10,
  likes: 2,
  sizeCategory: "10K<n<100K",
  modalities: ["text"],
  tags: ["odia"],
  createdAt: "2025-01-01",
  updatedAt: "2026-01-01",
};

const ghResource = {
  kind: "gh" as const,
  id: "openodia/repo",
  name: "repo",
  author: "openodia",
  url: "https://github.com/openodia/repo",
  description: "",
  license: "MIT",
  topic: "TypeScript",
  stars: 5,
  tags: [],
};

const bareResource = {
  kind: "gh" as const,
  id: "openodia/bare",
  name: "bare",
  author: "openodia",
  url: "https://github.com/openodia/bare",
  description: "",
  license: "",
  topic: "",
  tags: [],
  updatedAt: "not-a-real-date",
};

const modelResource = {
  kind: "model" as const,
  id: "openodia/model",
  name: "model",
  author: "openodia",
  url: "https://huggingface.co/openodia/model",
  description: "A model.",
  license: "apache-2.0",
  topic: "text-classification",
  tags: [],
};

describe("r/$ resource loader", () => {
  it("throws not found for an unparsable splat", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    await expect(loader({ params: {} })).rejects.toThrow("not found");
  });

  it("throws not found and logs when loadResource rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockRejectedValueOnce(new Error("upstream down"));
    await expect(loader({ params: { _splat: "model/openodia/model" } })).rejects.toThrow(
      "not found",
    );
  });

  it("throws not found when loadResource resolves null", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockResolvedValueOnce(null);
    await expect(loader({ params: { _splat: "model/missing" } })).rejects.toThrow("not found");
  });

  it("loads a dataset, its preview, and a matching catalog listing", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockResolvedValueOnce(datasetResource);
    previewMocks.loadDatasetPreview.mockResolvedValueOnce({
      available: true,
      config: "default",
      split: "train",
      columns: ["text"],
      rows: [["hi"]],
    });
    catalogMocks.loadCatalog.mockResolvedValueOnce([
      { permalink: "/r/dataset/openodia/data", sources: ["example-catalog", "unknown-source"] },
      { permalink: "/r/dataset/other", sources: ["example-catalog"] },
    ]);
    const data = (await loader({ params: { _splat: "dataset/openodia/data" } })) as {
      resource: unknown;
      preview: { available: boolean };
      listedIn: { name: string }[];
    };
    expect(data.resource).toEqual(datasetResource);
    expect(data.preview.available).toBe(true);
    expect(data.listedIn).toEqual([
      { name: "Example Catalog", url: "https://example.com/catalog" },
    ]);
  });

  it("skips the preview for non-dataset kinds and reports an unmatched catalog as empty", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockResolvedValueOnce(ghResource);
    catalogMocks.loadCatalog.mockResolvedValueOnce([
      { permalink: "/r/dataset/unrelated", sources: ["example-catalog"] },
    ]);
    const data = (await loader({ params: { _splat: "gh/openodia/repo" } })) as {
      preview: unknown;
      listedIn: unknown[];
    };
    expect(data.preview).toBeNull();
    expect(data.listedIn).toEqual([]);
    expect(previewMocks.loadDatasetPreview).not.toHaveBeenCalled();
  });

  it("falls back to an unavailable preview when the dataset viewer errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockResolvedValueOnce(datasetResource);
    previewMocks.loadDatasetPreview.mockRejectedValueOnce(new Error("viewer down"));
    catalogMocks.loadCatalog.mockResolvedValueOnce([]);
    const data = (await loader({ params: { _splat: "dataset/openodia/data" } })) as {
      preview: { available: boolean; reason: string };
    };
    expect(data.preview.available).toBe(false);
    expect(data.preview.reason).toBe("The dataset viewer is unreachable.");
  });

  it("swallows a catalog load failure as an empty listedIn", async () => {
    const { loader } = await loadRoute(() => import("../src/routes/r.$"));
    resourceMocks.loadResource.mockResolvedValueOnce(ghResource);
    catalogMocks.loadCatalog.mockRejectedValueOnce(new Error("catalog down"));
    const data = (await loader({ params: { _splat: "gh/openodia/repo" } })) as {
      listedIn: unknown[];
    };
    expect(data.listedIn).toEqual([]);
  });

  it("builds head metadata, falling back to a generated description", async () => {
    const { head } = await loadRoute(() => import("../src/routes/r.$"));
    expect(head({ loaderData: undefined })).toEqual({});

    const withDescription = head({ loaderData: { resource: datasetResource } }) as {
      meta: { content?: string }[];
    };
    expect(withDescription.meta.some((m) => m.content === datasetResource.description)).toBe(true);

    const withoutDescription = head({ loaderData: { resource: ghResource } }) as {
      meta: { content?: string }[];
    };
    expect(
      withoutDescription.meta.some((m) => m.content?.includes("listed in the OpenOdia directory")),
    ).toBe(true);
  });
});

describe("r/$ resource page", () => {
  it("renders a dataset with an available preview and links back to Datasets", async () => {
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = {
      resource: datasetResource,
      preview: {
        available: true,
        config: "default",
        split: "train",
        columns: ["text"],
        rows: [["hi"]],
      },
      listedIn: [{ name: "Example Catalog", url: "https://example.com/catalog" }],
    };
    renderComponent(ResourcePage);
    expect(screen.getByText("Datasets")).toBeInTheDocument();
    expect(screen.getByText("Example Catalog")).toBeInTheDocument();
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("renders an unavailable preview reason", async () => {
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = {
      resource: datasetResource,
      preview: { available: false, reason: "The dataset viewer is unreachable." },
      listedIn: [],
    };
    renderComponent(ResourcePage);
    expect(screen.getByText("The dataset viewer is unreachable.")).toBeInTheDocument();
  });

  it("renders a model resource and links back to Models", async () => {
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = { resource: modelResource, preview: null, listedIn: [] };
    renderComponent(ResourcePage);
    expect(screen.getByText("Models")).toBeInTheDocument();
  });

  it("renders a gh resource, links back to Tools, and defaults listedIn when absent", async () => {
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = { resource: ghResource, preview: null };
    renderComponent(ResourcePage);
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Open on GitHub")).toBeInTheDocument();
  });

  it("renders a resource without a license, topic, or a parsable date", async () => {
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = { resource: bareResource, preview: null, listedIn: [] };
    renderComponent(ResourcePage);
    expect(screen.getByText("bare")).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it("copies the link, reports success, and reverts the label after a delay", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = { resource: datasetResource, preview: null, listedIn: [] };
    renderComponent(ResourcePage);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument(),
      { timeout: 3000 },
    );
  }, 8000);

  it("falls back silently when copying the link fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { component: ResourcePage } = await loadRoute(() => import("../src/routes/r.$"));
    routeHarness.loaderData["/r/$"] = { resource: datasetResource, preview: null, listedIn: [] };
    renderComponent(ResourcePage);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument(),
    );
  });
});
