import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeHarness = vi.hoisted(() => ({
  loaderData: {} as Record<string, unknown>,
  search: {} as Record<string, Record<string, unknown>>,
  navigate: vi.fn(),
  invalidate: vi.fn(),
  infinite: {
    data: { pages: [] as Array<{ events: unknown[]; total: number; nextCursor?: string }> },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  },
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const makeRoute = (path: string, options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => routeHarness.loaderData[path],
    useSearch: () => routeHarness.search[path] ?? {},
    useNavigate: () => routeHarness.navigate,
    useRouteContext: () => ({ queryClient: {} }),
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
    createRootRouteWithContext: () => (options: Record<string, unknown>) =>
      makeRoute("root", options),
    Link,
    Outlet: () => React.createElement("div", null, "outlet"),
    HeadContent: () => null,
    Scripts: () => null,
    notFound: () => new Error("not found"),
    useNavigate: () => routeHarness.navigate,
    useRouter: () => ({ invalidate: routeHarness.invalidate }),
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
  useQuery: () => ({
    data: {
      channels: [
        {
          name: "OpenOdia",
          videos: [
            { id: "one", title: "One", published: "2026-01-03" },
            { id: "two", title: "Two", published: "2026-01-02" },
            { id: "three", title: "Three", published: "2026-01-01" },
          ],
        },
      ],
    },
  }),
  useInfiniteQuery: () => routeHarness.infinite,
  QueryClientProvider: ({ children }: { children?: React.ReactNode }) => children,
  QueryClient: class {},
}));

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children, hidden }: { children?: React.ReactNode; hidden?: boolean }) =>
    hidden ? null : children,
}));
vi.mock("../src/components/MagneticButton", () => ({
  MagneticButton: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}));
vi.mock("../src/components/ContributorGrid", () => ({ ContributorGrid: () => null }));
vi.mock("../src/components/ContributorLeaderboard", () => ({
  ContributorLeaderboard: () => null,
}));
vi.mock("../src/components/FaqSection", () => ({ FaqSection: () => null, FAQS: [] }));
vi.mock("../src/components/Marquee", () => ({ Marquee: () => null }));
vi.mock("../src/components/FeaturedGallery", () => ({
  FeaturedGallery: () => null,
  formatCount: (value: number) => String(value),
}));
vi.mock("../src/components/ResourceMeta", () => ({
  ResourceMeta: () => null,
  LicenseBadge: ({ spdx }: { spdx?: string }) => <span>{spdx}</span>,
}));
vi.mock("../src/components/Facets", () => ({
  ActiveFilterBar: () => null,
  Chip: ({ label }: { label: string }) => <button>{label}</button>,
  EmptyResults: () => <p>No results</p>,
  FacetGroup: () => null,
  ResultCount: ({ shown, total }: { shown: number; total: number }) => (
    <span>{`${shown}/${total}`}</span>
  ),
}));
vi.mock("../src/components/CodeEditor", () => ({
  CodeEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <textarea
      aria-label="editor"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock("../src/components/Transliterate", () => ({
  Transliterate: () => <div>transliterate</div>,
}));
vi.mock("@devsuvam/odialang/dist/lexer/tokenizer", () => ({
  tokenize: (source: string) => source,
}));
vi.mock("@devsuvam/odialang/dist/parser/parser", () => ({
  Parser: class {
    parseProgram() {
      return {};
    }
  },
}));
vi.mock("@devsuvam/odialang/dist/codegen/generate", () => ({
  generateJavaScript: () => 'console.log("odia output")',
}));
vi.mock("../src/components/Nav", () => ({ Nav: () => <nav>nav</nav> }));
vi.mock("../src/components/Footer", () => ({ Footer: () => <footer>footer</footer> }));
vi.mock("../src/components/ScrollToTop", () => ({ ScrollToTop: () => null }));
vi.mock("../src/components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("../src/lib/i18n", () => ({
  I18nProvider: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  siteOrganization: () => ({}),
  authorPerson: () => ({}),
  webSiteSchema: () => ({}),
  breadcrumbSchema: () => ({}),
  eventListSchema: () => ({}),
  faqPageSchema: () => ({}),
  itemListSchema: () => ({}),
  videoListSchema: () => ({}),
}));

type RouteModule = { Route: { options: { component: ComponentType } } };

async function renderRoute(path: string, importer: () => Promise<unknown>) {
  const module = (await importer()) as RouteModule;
  const Component = module.Route.options.component;
  const view = render(<Component />);
  expect(view.container.firstChild).not.toBeNull();
  return view;
}

const model = {
  id: "openodia/model",
  author: "openodia",
  name: "model",
  url: "https://huggingface.co/openodia/model",
  task: "text-classification",
  library: "transformers",
  license: "apache-2.0",
  downloads: 1200,
  likes: 50,
  tags: ["odia"],
  createdAt: "2025-01-01",
};

const dataset = {
  id: "openodia/data",
  author: "openodia",
  name: "data",
  url: "https://huggingface.co/datasets/openodia/data",
  description: "An Odia dataset.",
  task: "translation",
  license: "cc-by-4.0",
  sizeCategory: "10K<n<100K",
  modalities: ["text"],
  downloads: 2500,
  likes: 60,
  tags: ["odia", "translation"],
  createdAt: "2025-02-01",
};

afterEach(() => {
  cleanup();
  routeHarness.navigate.mockClear();
  routeHarness.invalidate.mockClear();
});

describe("route rendering", () => {
  it("renders root shell, application frame, not-found, and error recovery", async () => {
    const root = await import("../src/routes/__root");
    const options = root.Route.options as unknown as {
      head: () => { meta: unknown[]; links: unknown[] };
      shellComponent: ComponentType<{ children: React.ReactNode }>;
      component: ComponentType;
      notFoundComponent: ComponentType;
      errorComponent: ComponentType<{ error: Error; reset: () => void }>;
    };
    expect(options.head().meta.length).toBeGreaterThan(5);
    expect(options.head().links.length).toBeGreaterThan(1);

    const Shell = options.shellComponent;
    render(
      <Shell>
        <span>shell child</span>
      </Shell>,
    );
    expect(screen.getByText("shell child")).toBeInTheDocument();
    cleanup();

    const Root = options.component;
    render(<Root />);
    expect(screen.getByText("outlet")).toBeInTheDocument();
    cleanup();

    const NotFound = options.notFoundComponent;
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    cleanup();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    const ErrorView = options.errorComponent;
    render(<ErrorView error={new Error("broken route")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(routeHarness.invalidate).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it("renders the home and static information routes", async () => {
    routeHarness.loaderData["/"] = {
      projects: 12,
      models: { value: 4, approx: true },
      datasets: { value: 3, approx: false },
    };
    await renderRoute("/", () => import("../src/routes/index"));
    expect(screen.getByText("12")).toBeInTheDocument();
    cleanup();

    await renderRoute("/about", () => import("../src/routes/about"));
    expect(screen.getByText("About")).toBeInTheDocument();
    cleanup();

    await renderRoute("/contribute", () => import("../src/routes/contribute"));
    expect(screen.getByText(/Add your/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    cleanup();

    await renderRoute("/api/", () => import("../src/routes/api/index"));
    expect(document.querySelector("#api-reference")).toHaveAttribute(
      "data-url",
      "/.well-known/openapi.json",
    );
  });

  it("renders populated model, dataset, paper, and tool directories", async () => {
    routeHarness.loaderData["/models"] = { models: [model], truncated: true, failed: true };
    await renderRoute("/models", () => import("../src/routes/models"));
    expect(screen.getByText("model")).toBeInTheDocument();
    cleanup();

    routeHarness.loaderData["/datasets"] = {
      datasets: [dataset],
      truncated: true,
      failed: true,
    };
    await renderRoute("/datasets", () => import("../src/routes/datasets"));
    expect(screen.getByText("data")).toBeInTheDocument();
    cleanup();

    routeHarness.loaderData["/papers"] = {
      failed: true,
      papers: [
        {
          id: "paper-1",
          title: "Odia translation",
          authors: ["A. Author"],
          year: 2026,
          venue: "arXiv",
          url: "https://example.com/paper",
          pdfUrl: "https://example.com/paper.pdf",
          abstract: "Translation research.",
          openAccess: true,
          tasks: ["Translation"],
          sources: ["arXiv"],
        },
      ],
    };
    await renderRoute("/papers", () => import("../src/routes/papers"));
    expect(screen.getByText("Odia translation")).toBeInTheDocument();
    cleanup();

    routeHarness.loaderData["/tools"] = {
      awesome: [
        {
          name: "Odia Tool",
          url: "https://example.com/tool",
          description: "An Odia tool (MIT).",
          category: "Utilities",
          subcategory: "Text",
        },
      ],
      repos: [
        {
          full_name: "openodia/repo",
          html_url: "https://github.com/openodia/repo",
          description: "Repo",
          stargazers_count: 10,
          language: "TypeScript",
          license: { spdx_id: "MIT" },
          created_at: "2025-01-01",
        },
      ],
      licenses: {},
      awesomeFailed: true,
      reposFailed: true,
    };
    await renderRoute("/tools", () => import("../src/routes/tools"));
    expect(screen.getByText("Odia Tool")).toBeInTheDocument();
  });

  it("renders tutorials, treebank search, and a resource detail", async () => {
    routeHarness.loaderData["/tutorials"] = {
      channels: [
        {
          handle: "@openodia",
          name: "OpenOdia",
          url: "https://youtube.com/@openodia",
          videos: [
            {
              id: "video-1",
              title: "Odia NLP",
              published: "2026-01-01",
              thumbnail: "thumb.jpg",
              channelName: "OpenOdia",
              channelHandle: "@openodia",
              channelUrl: "https://youtube.com/@openodia",
              viewCount: 100,
            },
          ],
          playlists: [
            {
              id: "playlist-1",
              title: "Lessons",
              description: "Learn",
              thumbnail: "playlist.jpg",
              itemCount: 3,
            },
          ],
        },
      ],
    };
    await renderRoute("/tutorials", () => import("../src/routes/tutorials"));
    expect(screen.getByText("Odia NLP")).toBeInTheDocument();
    cleanup();

    routeHarness.search["/treebank"] = { q: "ଓଡ଼ିଆ", upos: "NOUN", deprel: "root" };
    routeHarness.loaderData["/treebank"] = {
      failed: true,
      result: {
        hits: [
          {
            sentence: {
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
              ],
            },
            matches: [0],
          },
        ],
        total: 1,
        uposCounts: [["NOUN", 1]],
        deprelCounts: [["root", 1]],
        sentenceCount: 1,
        tokenCount: 1,
      },
    };
    await renderRoute("/treebank", () => import("../src/routes/treebank"));
    expect(screen.getByText("Odia language")).toBeInTheDocument();
    cleanup();

    routeHarness.loaderData["/r/$"] = {
      resource: {
        kind: "dataset",
        id: "openodia/data",
        name: "data",
        author: "openodia",
        url: "https://huggingface.co/datasets/openodia/data",
        description: "Dataset description",
        license: "CC-BY-4.0",
        topic: "translation",
        downloads: 20,
        likes: 3,
        sizeCategory: "10K<n<100K",
        modalities: ["text"],
        tags: ["odia"],
        createdAt: "2025-01-01",
        updatedAt: "2026-01-01",
      },
      preview: {
        available: true,
        config: "default",
        split: "train",
        columns: ["text"],
        rows: [["ଓଡ଼ିଆ"]],
      },
      listedIn: [{ name: "Catalog", url: "https://example.com" }],
    };
    await renderRoute("/r/$", () => import("../src/routes/r.$"));
    expect(screen.getByText("Dataset description")).toBeInTheDocument();
  });

  it("renders events and the Odialang playground without loading Pyodide", async () => {
    await renderRoute("/events", () => import("../src/routes/events"));
    expect(screen.getAllByText(/Odia AI/i).length).toBeGreaterThan(0);
    cleanup();

    routeHarness.search["/playground"] = { tab: "odia" };
    await renderRoute("/playground", () => import("../src/routes/playground"));
    expect(screen.getByText(/Odialang compiles/i)).toBeInTheDocument();
  });

  it("boots, runs, formats, copies, clears, and switches the Python playground", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeHarness.search["/playground"] = {};

    await renderRoute("/playground", () => import("../src/routes/playground"));
    const failedScript = document.querySelectorAll("#pyodide-script").item(0);
    fireEvent.error(failedScript);
    expect(await screen.findByText("Failed to load Pyodide from CDN")).toBeInTheDocument();
    cleanup();

    let stdout: ((value: string) => void) | undefined;
    const install = vi.fn().mockResolvedValue(undefined);
    const runPythonAsync = vi.fn(async (code: string) => {
      if (code.includes("black.format_str")) return "print('formatted')\n";
      stdout?.("python output");
      return undefined;
    });
    const py = {
      loadPackage: vi.fn().mockResolvedValue(undefined),
      pyimport: vi.fn(() => ({ install })),
      runPythonAsync,
      globals: { set: vi.fn() },
      setStdout: vi.fn(({ batched }: { batched: (value: string) => void }) => {
        stdout = batched;
      }),
      setStderr: vi.fn(),
    };
    window.loadPyodide = vi.fn().mockResolvedValue(py);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    await renderRoute("/playground", () => import("../src/routes/playground"));
    const scripts = document.querySelectorAll("#pyodide-script");
    fireEvent.load(scripts.item(scripts.length - 1));
    expect(await screen.findByText("Ready. Hit Run to execute.")).toBeInTheDocument();
    expect(py.loadPackage).toHaveBeenCalledWith(["numpy", "pygments"]);
    expect(py.loadPackage).toHaveBeenCalledWith("micropip");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("python output")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("python output\n");
    fireEvent.click(screen.getByRole("button", { name: "Clear output" }));
    expect(screen.getByText("Output appears here after you click Run.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Format/ }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "editor" })).toHaveValue("print('formatted')\n"),
    );
    expect(install).toHaveBeenCalledWith("black");

    fireEvent.click(screen.getByRole("button", { name: "Same word, two spellings" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(install).toHaveBeenCalledWith("indic-nlp-library"));

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(requestFullscreen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Transliteration" }));
    expect(screen.getByText("transliterate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Odialang" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("odia output")).toBeInTheDocument();
    expect(routeHarness.navigate).toHaveBeenCalled();
  });
});
