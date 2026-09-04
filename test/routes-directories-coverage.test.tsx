import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveFilter, FacetOption } from "../src/lib/facets";
import type { Model, Dataset } from "../src/lib/sources/huggingface";
import type { Paper } from "../src/lib/sources/papers";
import type { Item } from "../src/lib/sources/awesome";
import type { Repo } from "../src/lib/sources/repos";

const harness = vi.hoisted(() => ({
  loaderData: {} as Record<string, unknown>,
  invalidate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const makeRoute = (path: string, options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => harness.loaderData[path],
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
    useRouter: () => ({ invalidate: harness.invalidate }),
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

vi.mock("../src/components/Reveal", () => ({
  Reveal: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("../src/components/FeaturedGallery", () => ({
  FeaturedGallery: () => null,
  formatCount: (value: number) => String(value),
}));
vi.mock("../src/components/ResourceMeta", () => ({ ResourceMeta: () => null }));
vi.mock("../src/components/icons", () => ({ GithubIcon: () => null }));
vi.mock("../src/hooks/useSearchShortcut", () => ({ useSearchShortcut: () => undefined }));
vi.mock("../src/lib/jsonld", () => ({
  JsonLd: () => null,
  breadcrumbSchema: () => ({}),
  itemListSchema: () => ({}),
}));

vi.mock("../src/components/Facets", () => ({
  Chip: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  EmptyResults: ({
    noun,
    onClearAll,
  }: {
    query: string;
    filters: ActiveFilter[];
    onClearAll: () => void;
    noun: string;
  }) => (
    <div>
      <p>No {noun} found</p>
      <button onClick={onClearAll}>Clear all (empty state)</button>
    </div>
  ),
  ActiveFilterBar: ({
    filters,
    onRemove,
    onClearAll,
  }: {
    filters: ActiveFilter[];
    onRemove: (f: ActiveFilter) => void;
    onClearAll: () => void;
  }) =>
    filters.length === 0 ? null : (
      <div>
        {filters.map((f) => (
          <button key={`${f.facet}:${f.value}`} onClick={() => onRemove(f)}>
            {`remove:${f.facet}:${f.value}`}
          </button>
        ))}
        <button onClick={onClearAll}>Clear all</button>
      </div>
    ),
  FacetGroup: ({
    title,
    options,
    onToggle,
  }: {
    title: string;
    options: FacetOption[];
    selected: Set<string>;
    onToggle: (value: string) => void;
  }) =>
    options.length === 0 ? null : (
      <div>
        {options.map((o) => (
          <button key={o.value} onClick={() => onToggle(o.value)}>
            {`${title}:${o.label}:${o.count}`}
          </button>
        ))}
      </div>
    ),
  ResultCount: ({ shown, total }: { shown: number; total: number }) => (
    <span>{`${shown}/${total}`}</span>
  ),
}));

vi.mock("../src/lib/sources/huggingface", () => ({
  loadModels: vi.fn(),
  loadDatasets: vi.fn(),
}));
vi.mock("../src/lib/sources/papers", () => ({ loadPapers: vi.fn() }));
vi.mock("../src/lib/sources/awesome", () => ({ loadAwesome: vi.fn() }));
vi.mock("../src/lib/sources/awesome-licenses", () => ({ loadAwesomeLicenses: vi.fn() }));
vi.mock("../src/lib/sources/repos", () => ({ loadRepos: vi.fn() }));

import { loadModels, loadDatasets } from "../src/lib/sources/huggingface";
import { loadPapers } from "../src/lib/sources/papers";
import { loadAwesome } from "../src/lib/sources/awesome";
import { loadAwesomeLicenses } from "../src/lib/sources/awesome-licenses";
import { loadRepos } from "../src/lib/sources/repos";

type RouteOptions = {
  loader: () => Promise<unknown>;
  head: () => { meta: Array<{ title?: string }> };
  component: ComponentType;
};
type RouteModule = { Route: { options: RouteOptions } };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildModels(): Model[] {
  const base: Model[] = [
    {
      id: "openodia/flagship-model",
      author: "openodia",
      name: "flagship-model",
      url: "https://huggingface.co/openodia/flagship-model",
      task: "text-classification",
      library: "transformers",
      license: "apache-2.0",
      downloads: 500,
      likes: 40,
      tags: ["odia"],
      createdAt: "2025-01-01",
    },
    {
      id: "openodia/custom-model",
      author: "openodia",
      name: "custom-model",
      url: "https://huggingface.co/openodia/custom-model",
      task: "custom-pipeline-task",
      library: "",
      license: "apache-2.0",
      downloads: 10,
      likes: 12,
      tags: ["odia"],
      createdAt: "2025-01-02",
    },
    {
      id: "openodia/tag-only-model",
      author: "someauthor",
      name: "tag-only-model",
      url: "https://huggingface.co/openodia/tag-only-model",
      task: "translation",
      library: "",
      license: "mit",
      downloads: 5,
      likes: 6,
      tags: ["odia", "zzzspecialtag"],
      createdAt: "2025-01-03",
    },
  ];
  const filler: Model[] = Array.from({ length: 30 }, (_, i) => ({
    id: `openodia/filler-model-${i}`,
    author: "openodia",
    name: `filler-model-${i}`,
    url: `https://huggingface.co/openodia/filler-model-${i}`,
    task: i % 2 === 0 ? "text-generation" : "translation",
    library: "transformers",
    license: "apache-2.0",
    downloads: 20 + i,
    likes: 5 + i,
    tags: ["odia"],
    createdAt: "2025-02-01",
  }));
  return [...base, ...filler];
}

function buildDatasets(): Dataset[] {
  const base: Dataset[] = [
    {
      id: "openodia/flagship-data",
      author: "openodia",
      name: "flagship-data",
      url: "https://huggingface.co/datasets/openodia/flagship-data",
      description: "Flagship dataset.",
      task: "translation",
      license: "cc-by-4.0",
      sizeCategory: "n<1K",
      modalities: ["text"],
      downloads: 500,
      likes: 40,
      tags: ["odia"],
      createdAt: "2025-01-01",
    },
    {
      id: "openodia/other-task-data",
      author: "openodia",
      name: "other-task-data",
      url: "https://huggingface.co/datasets/openodia/other-task-data",
      description: "Untagged task dataset.",
      task: "other",
      license: "mit",
      sizeCategory: "1K<n<10K",
      modalities: ["text"],
      downloads: 8,
      likes: 9,
      tags: ["odia"],
      createdAt: "2025-01-02",
    },
    {
      id: "openodia/tag-only-data",
      author: "someauthor",
      name: "tag-only-data",
      url: "https://huggingface.co/datasets/openodia/tag-only-data",
      description: "Neutral description.",
      task: "classification",
      license: "mit",
      sizeCategory: "10K<n<100K",
      modalities: ["text"],
      downloads: 5,
      likes: 6,
      tags: ["odia", "zzzdatatag"],
      createdAt: "2025-01-03",
    },
    {
      id: "openodia/no-description-data",
      author: "openodia",
      name: "no-description-data",
      url: "https://huggingface.co/datasets/openodia/no-description-data",
      // Empty description exercises the `d.description || prettyTask(...)`
      // fallback used to build the JSON-LD item list.
      description: "",
      task: "translation",
      license: "mit",
      sizeCategory: "1K<n<10K",
      modalities: ["text"],
      downloads: 3,
      likes: 4,
      tags: ["odia"],
      createdAt: "2025-01-04",
    },
  ];
  const buckets = ["1K<n<10K", "10K<n<100K", "100K<n<1M"];
  const filler: Dataset[] = Array.from({ length: 30 }, (_, i) => ({
    id: `openodia/filler-data-${i}`,
    author: "openodia",
    name: `filler-data-${i}`,
    url: `https://huggingface.co/datasets/openodia/filler-data-${i}`,
    description: `Filler dataset ${i}.`,
    task: i % 2 === 0 ? "translation" : "classification",
    license: "cc-by-4.0",
    sizeCategory: buckets[i % buckets.length],
    modalities: ["text"],
    downloads: 20 + i,
    likes: 5 + i,
    tags: ["odia"],
    createdAt: "2025-02-01",
  }));
  return [...base, ...filler];
}

function buildPapers(): Paper[] {
  const base: Paper[] = [
    {
      id: "paper-recent",
      title: "Recent Odia NLP survey",
      authors: ["A. Author"],
      year: 2026,
      venue: "arXiv",
      url: "https://example.com/paper-recent",
      pdfUrl: "https://example.com/paper-recent.pdf",
      abstract: "A recent survey.",
      openAccess: true,
      tasks: ["Translation"],
      sources: ["arxiv"],
    },
    {
      id: "paper-2021",
      title: "Odia sentiment analysis",
      authors: ["B. Author"],
      year: 2021,
      venue: "COLING",
      url: "https://example.com/paper-2021",
      abstract: "Sentiment work.",
      openAccess: false,
      tasks: ["Sentiment"],
      sources: ["openalex"],
    },
    {
      id: "paper-2017",
      title: "Odia parsing techniques",
      authors: ["C. Author"],
      year: 2017,
      venue: "LREC",
      url: "https://example.com/paper-2017",
      abstract: "Parsing techniques.",
      openAccess: false,
      tasks: ["Parsing"],
      sources: ["openalex"],
    },
    {
      id: "paper-old",
      title: "Early Odia computing",
      authors: ["D. Author"],
      year: 2010,
      venue: "",
      url: "https://example.com/paper-old",
      abstract: "Older work.",
      openAccess: false,
      tasks: [],
      sources: ["openalex"],
    },
    {
      id: "paper-undated",
      title: "Undated Odia note",
      authors: ["Zaphira Specialauthor"],
      year: null,
      venue: "",
      url: "https://example.com/paper-undated",
      abstract: "No year recorded.",
      openAccess: false,
      tasks: [],
      sources: ["openalex"],
    },
  ];
  const filler: Paper[] = Array.from({ length: 25 }, (_, i) => ({
    id: `paper-filler-${i}`,
    title: `Filler paper ${i}`,
    authors: [`Filler Author ${i}`],
    year: 2022,
    venue: "arXiv",
    url: `https://example.com/paper-filler-${i}`,
    abstract: "Filler abstract text.",
    openAccess: false,
    tasks: [],
    sources: ["arxiv"],
  }));
  return [...base, ...filler];
}

function buildAwesome(): Item[] {
  return [
    {
      name: "GH Tool",
      url: "https://github.com/exampleorg/exampletool",
      description: "A curated GitHub tool.",
      category: "Utilities",
      subcategory: "CLI",
    },
    {
      name: "HF Dataset Tool",
      url: "https://huggingface.co/datasets/exampleorg/exampledata",
      description: "A curated dataset link.",
      category: "Datasets",
    },
    {
      name: "Broken URL Tool",
      url: "not a valid url",
      description: "Malformed link.",
      category: "Misc",
    },
    {
      name: "External Site Tool",
      url: "https://example.com/project",
      description: "External homepage.",
      category: "Misc",
    },
    {
      name: "Bare Datasets Root",
      url: "https://huggingface.co/datasets",
      description: "No dataset id in the path.",
      category: "Misc",
    },
    {
      name: "Bare GitHub Host",
      url: "https://github.com",
      description: "No owner/repo in the path.",
      category: "Misc",
    },
  ];
}

function buildRepos(): Repo[] {
  const hero: Repo[] = [
    {
      name: "repo-a",
      full_name: "openodia/repo-a",
      html_url: "https://github.com/openodia/repo-a",
      description: "Repo A",
      stargazers_count: 120,
      language: "Python",
      license: { spdx_id: "MIT" },
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      fork: false,
      archived: false,
    },
    {
      name: "repo-b",
      full_name: "openodia/repo-b",
      html_url: "https://github.com/openodia/repo-b",
      description: "Repo B",
      stargazers_count: 110,
      language: null,
      license: { spdx_id: "Apache-2.0" },
      created_at: "2024-01-02",
      updated_at: "2024-01-02",
      fork: false,
      archived: false,
    },
    {
      name: "repo-c",
      full_name: "openodia/repo-c",
      html_url: "https://github.com/openodia/repo-c",
      description: "Repo C",
      stargazers_count: 100,
      language: "Python",
      license: { spdx_id: "MIT" },
      created_at: "2024-01-03",
      updated_at: "2024-01-03",
      fork: false,
      archived: false,
    },
    {
      name: "repo-d",
      full_name: "openodia/repo-d",
      html_url: "https://github.com/openodia/repo-d",
      description: "Repo D",
      stargazers_count: 90,
      language: null,
      license: { spdx_id: "MIT" },
      created_at: "2024-01-04",
      updated_at: "2024-01-04",
      fork: false,
      archived: false,
    },
  ];
  const filler: Repo[] = Array.from({ length: 28 }, (_, i) => ({
    name: `filler-repo-${i}`,
    full_name: `openodia/filler-repo-${i}`,
    html_url: `https://github.com/openodia/filler-repo-${i}`,
    description: `Filler repo ${i}`,
    stargazers_count: 1,
    language: "JavaScript",
    license: { spdx_id: "MIT" },
    created_at: "2024-02-01",
    updated_at: "2024-02-01",
    fork: false,
    archived: false,
  }));
  // No description/language/star count — exercises the `??` fallbacks in the
  // repo mapper, the stars sort comparator, and the card's star badge. Two
  // entries so the sort comparator sees the undefined value on both sides.
  const noFallbackData: Repo[] = [
    {
      name: "repo-no-metadata",
      full_name: "openodia/repo-no-metadata",
      html_url: "https://github.com/openodia/repo-no-metadata",
      description: null,
      language: null,
      stargazers_count: undefined as unknown as number,
      license: { spdx_id: "MIT" },
      created_at: "2024-02-02",
      updated_at: "2024-02-02",
      fork: false,
      archived: false,
    },
    {
      name: "repo-no-metadata-2",
      full_name: "openodia/repo-no-metadata-2",
      html_url: "https://github.com/openodia/repo-no-metadata-2",
      description: null,
      language: null,
      stargazers_count: undefined as unknown as number,
      license: { spdx_id: "MIT" },
      created_at: "2024-02-03",
      updated_at: "2024-02-03",
      fork: false,
      archived: false,
    },
  ];
  return [...hero, ...filler, ...noFallbackData];
}

describe("models route directory coverage", () => {
  it("covers the loader success/failure branches and head metadata", async () => {
    const modelsModule = (await import("../src/routes/models")) as unknown as RouteModule;

    vi.mocked(loadModels).mockResolvedValueOnce({ items: [], truncated: true });
    const success = await modelsModule.Route.options.loader();
    expect(success).toEqual({ models: [], truncated: true, failed: false });

    vi.mocked(loadModels).mockRejectedValueOnce(new Error("hf down"));
    const failure = await modelsModule.Route.options.loader();
    expect(failure).toEqual({ models: [], truncated: false, failed: true });

    const head = modelsModule.Route.options.head();
    expect(head.meta[0]).toEqual({ title: "Models · OpenOdia" });
  });

  it("renders search, taskLabel fallback, facets, pagination, and the failed banner", async () => {
    const modelsModule = (await import("../src/routes/models")) as unknown as RouteModule;
    harness.loaderData["/models"] = { models: buildModels(), truncated: true, failed: true };
    const Component = modelsModule.Route.options.component;
    render(<Component />);

    expect(screen.getByRole("status")).toHaveTextContent("Hugging Face is unreachable");
    expect(screen.getByText("Custom pipeline task")).toBeInTheDocument();
    expect(screen.getByText(/registry stops at/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    expect(screen.getByText("33/33")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search models, authors, tags… [/]");
    fireEvent.change(input, { target: { value: "zzzspecialtag" } });
    expect(screen.getByText("tag-only-model")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "no-such-model-anywhere" } });
    expect(screen.getByText("No models found")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all (empty state)"));
    expect(input).toHaveValue("");

    const [firstTaskFacetOption] = screen.getAllByText(/^Task:/);
    fireEvent.click(firstTaskFacetOption);
    expect(screen.getByText(/^remove:task:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.queryByText(/^remove:task:/)).not.toBeInTheDocument();

    const [taskFacetOptionAgain] = screen.getAllByText(/^Task:/);
    fireEvent.click(taskFacetOptionAgain);
    fireEvent.click(screen.getByText(/^remove:task:/));
    expect(screen.queryByText(/^remove:task:/)).not.toBeInTheDocument();
  }, 20000);
});

describe("datasets route directory coverage", () => {
  it("covers the loader success/failure branches and head metadata", async () => {
    const datasetsModule = (await import("../src/routes/datasets")) as unknown as RouteModule;

    vi.mocked(loadDatasets).mockResolvedValueOnce({ items: [], truncated: false });
    const success = await datasetsModule.Route.options.loader();
    expect(success).toEqual({ datasets: [], truncated: false, failed: false });

    vi.mocked(loadDatasets).mockRejectedValueOnce(new Error("hf down"));
    const failure = await datasetsModule.Route.options.loader();
    expect(failure).toEqual({ datasets: [], truncated: false, failed: true });

    const head = datasetsModule.Route.options.head();
    expect(head.meta[0]).toEqual({ title: "Datasets · OpenOdia" });
  });

  it("renders search, prettyTask fallback, size facet, pagination, and the failed banner", async () => {
    const datasetsModule = (await import("../src/routes/datasets")) as unknown as RouteModule;
    harness.loaderData["/datasets"] = {
      datasets: buildDatasets(),
      truncated: true,
      failed: true,
    };
    const Component = datasetsModule.Route.options.component;
    render(<Component />);

    expect(screen.getByRole("status")).toHaveTextContent("Hugging Face is unreachable");
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText(/browser stops at/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    expect(screen.getByText("34/34")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search datasets, authors, tags… [/]");
    fireEvent.change(input, { target: { value: "zzzdatatag" } });
    expect(screen.getByText("tag-only-data")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "no-such-dataset-anywhere" } });
    expect(screen.getByText("No datasets found")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all (empty state)"));
    expect(input).toHaveValue("");

    const [firstSizeFacetOption] = screen.getAllByText(/^Size:/);
    fireEvent.click(firstSizeFacetOption);
    expect(screen.getByText(/^remove:size:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.queryByText(/^remove:size:/)).not.toBeInTheDocument();

    const [sizeFacetOptionAgain] = screen.getAllByText(/^Size:/);
    fireEvent.click(sizeFacetOptionAgain);
    fireEvent.click(screen.getByText(/^remove:size:/));
    expect(screen.queryByText(/^remove:size:/)).not.toBeInTheDocument();
  }, 20000);
});

describe("papers route directory coverage", () => {
  it("covers the loader success/failure branches and head metadata", async () => {
    const papersModule = (await import("../src/routes/papers")) as unknown as RouteModule;

    vi.mocked(loadPapers).mockResolvedValueOnce([]);
    const success = await papersModule.Route.options.loader();
    expect(success).toEqual({ papers: [], failed: false });

    vi.mocked(loadPapers).mockRejectedValueOnce(new Error("papers down"));
    const failure = await papersModule.Route.options.loader();
    expect(failure).toEqual({ papers: [], failed: true });

    const head = papersModule.Route.options.head();
    expect(head.meta[0]).toEqual({ title: "Papers · OpenOdia" });
  });

  it("renders search-by-author, year buckets, pagination, and the failed banner", async () => {
    const papersModule = (await import("../src/routes/papers")) as unknown as RouteModule;
    harness.loaderData["/papers"] = { papers: buildPapers(), failed: true };
    const Component = papersModule.Route.options.component;
    render(<Component />);

    expect(screen.getByRole("status")).toHaveTextContent("Both paper sources are unreachable");

    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    expect(screen.getByText("30/30")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search titles, abstracts, authors, venues… [/]");
    fireEvent.change(input, { target: { value: "Zaphira Specialauthor" } });
    expect(screen.getByText("Undated Odia note")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "no-such-paper-anywhere" } });
    expect(screen.getByText("No papers found")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all (empty state)"));
    expect(input).toHaveValue("");

    const [firstYearFacetOption] = screen.getAllByText(/^Year:/);
    fireEvent.click(firstYearFacetOption);
    expect(screen.getByText(/^remove:year:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.queryByText(/^remove:year:/)).not.toBeInTheDocument();

    const [yearFacetOptionAgain] = screen.getAllByText(/^Year:/);
    fireEvent.click(yearFacetOptionAgain);
    fireEvent.click(screen.getByText(/^remove:year:/));
    expect(screen.queryByText(/^remove:year:/)).not.toBeInTheDocument();
  }, 20000);
});

describe("tools route directory coverage", () => {
  it("covers the loader success/failure branches and head metadata", async () => {
    const toolsModule = (await import("../src/routes/tools")) as unknown as RouteModule;

    vi.mocked(loadAwesome).mockResolvedValueOnce([]);
    vi.mocked(loadRepos).mockResolvedValueOnce([]);
    vi.mocked(loadAwesomeLicenses).mockResolvedValueOnce({});
    const success = await toolsModule.Route.options.loader();
    expect(success).toEqual({
      awesome: [],
      repos: [],
      licenses: {},
      awesomeFailed: false,
      reposFailed: false,
    });

    vi.mocked(loadAwesome).mockRejectedValueOnce(new Error("awesome down"));
    vi.mocked(loadRepos).mockRejectedValueOnce(new Error("repos down"));
    vi.mocked(loadAwesomeLicenses).mockRejectedValueOnce(new Error("licenses down"));
    const failure = await toolsModule.Route.options.loader();
    expect(failure).toEqual({
      awesome: [],
      repos: [],
      licenses: {},
      awesomeFailed: true,
      reposFailed: true,
    });

    const head = toolsModule.Route.options.head();
    expect(head.meta[0]).toEqual({ title: "Tools · OpenOdia" });
  });

  it("renders hero/reel cards, hostOwner branches, search, refresh, facets, and pagination", async () => {
    const toolsModule = (await import("../src/routes/tools")) as unknown as RouteModule;
    harness.loaderData["/tools"] = {
      awesome: buildAwesome(),
      repos: buildRepos(),
      licenses: {},
      awesomeFailed: true,
      reposFailed: true,
    };
    const Component = toolsModule.Route.options.component;
    const { container } = render(<Component />);

    expect(screen.getByText(/GitHub is rate-limiting us/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/Awesome-Odia-AI list is unreachable/)).toBeInTheDocument();

    // Hero + reel cards rendered (pickWeeklyFeatured pool has 4 qualifying repos).
    expect(screen.getByText("repo-a")).toBeInTheDocument();
    expect(screen.getByText("repo-d")).toBeInTheDocument();

    const backdropImg = container.querySelector(
      'img[src*="opengraph.githubassets.com"]',
    ) as HTMLImageElement;
    expect(backdropImg).not.toBeNull();
    fireEvent.error(backdropImg);
    expect(backdropImg.style.display).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(harness.invalidate).toHaveBeenCalled();

    const input = screen.getByPlaceholderText("Search projects, repos, datasets, models… [/]");
    fireEvent.change(input, { target: { value: "repo-a" } });
    await waitFor(() => expect(screen.getByText("1/1")).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "no-such-project-anywhere" } });
    await waitFor(() => expect(screen.getByText("No projects found")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Clear all (empty state)"));
    expect(input).toHaveValue("");

    await waitFor(() => expect(screen.getByText("30/40")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    await waitFor(() => expect(screen.getByText("40/40")).toBeInTheDocument());

    const [firstTypeFacetOption] = screen.getAllByText(/^Source:/);
    fireEvent.click(firstTypeFacetOption);
    await waitFor(() => expect(screen.getByText(/^remove:type:/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("Clear all"));
    await waitFor(() => expect(screen.queryByText(/^remove:type:/)).not.toBeInTheDocument());

    const [typeFacetOptionAgain] = screen.getAllByText(/^Source:/);
    fireEvent.click(typeFacetOptionAgain);
    fireEvent.click(screen.getByText(/^remove:type:/));
    await waitFor(() => expect(screen.queryByText(/^remove:type:/)).not.toBeInTheDocument());
  }, 20000);
});
