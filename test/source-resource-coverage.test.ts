import { afterEach, describe, expect, it, vi } from "vitest";

const resourceHarness = vi.hoisted(() => ({
  fetch: vi.fn(),
  repos: vi.fn(),
  models: vi.fn(),
  datasets: vi.fn(),
  license: vi.fn(),
}));

vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: resourceHarness.fetch }));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
}));
vi.mock("../src/lib/sources/repos", () => ({
  loadRepos: resourceHarness.repos,
  licenseFromRepoFile: resourceHarness.license,
}));
vi.mock("../src/lib/sources/huggingface", () => ({
  loadModels: resourceHarness.models,
  loadDatasets: resourceHarness.datasets,
  summarize: (value: string) => value,
}));

import { loadResource } from "../src/lib/sources/resource";

afterEach(() => {
  vi.clearAllMocks();
  resourceHarness.fetch.mockReset();
  resourceHarness.repos.mockReset();
  resourceHarness.models.mockReset();
  resourceHarness.datasets.mockReset();
  resourceHarness.license.mockReset();
});

describe("resource detail adapter", () => {
  it("uses cached GitHub repositories case-insensitively", async () => {
    resourceHarness.repos.mockResolvedValue([
      {
        name: "Repo",
        full_name: "OpenOdia/Repo",
        html_url: "https://github.com/OpenOdia/Repo",
        description: null,
        stargazers_count: 4,
        language: null,
        updated_at: "2026-01-01",
        created_at: "2025-01-01",
        fork: false,
        archived: false,
        license: { spdx_id: "MIT" },
        topics: ["odia"],
      },
    ]);
    await expect(loadResource({ kind: "gh", id: "openodia/repo" })).resolves.toMatchObject({
      id: "OpenOdia/Repo",
      description: "",
      topic: "",
      license: "MIT",
      stars: 4,
    });
    expect(resourceHarness.fetch).not.toHaveBeenCalled();
  });

  it("falls back to one GitHub request and resolves NOASSERTION licenses", async () => {
    resourceHarness.repos.mockRejectedValue(new Error("list offline"));
    resourceHarness.license.mockResolvedValue("OFL-1.1");
    resourceHarness.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "Font",
          full_name: "org/font",
          description: "Font repo",
          stargazers_count: 3,
          language: "CSS",
          license: { spdx_id: "NOASSERTION" },
          topics: ["font"],
          created_at: "2025-01-01",
          updated_at: "2026-01-01",
        }),
        { status: 200 },
      ),
    );
    await expect(loadResource({ kind: "gh", id: "org/font" })).resolves.toMatchObject({
      name: "Font",
      license: "OFL-1.1",
      topic: "CSS",
    });
    resourceHarness.fetch.mockResolvedValueOnce(new Response("no", { status: 404 }));
    await expect(loadResource({ kind: "gh", id: "missing/repo" })).resolves.toBeNull();
  });

  it("resolves a non-NOASSERTION license and omitted fields directly via normalizeSpdx", async () => {
    resourceHarness.repos.mockRejectedValue(new Error("offline"));
    resourceHarness.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "Bare",
          full_name: "org/bare",
          stargazers_count: 0,
          language: null,
          license: { spdx_id: "MIT" },
          created_at: "2025-01-01",
          updated_at: "2025-01-01",
        }),
        { status: 200 },
      ),
    );
    await expect(loadResource({ kind: "gh", id: "org/bare" })).resolves.toMatchObject({
      license: "MIT",
      description: "",
      topic: "",
      tags: [],
    });
    expect(resourceHarness.license).not.toHaveBeenCalled();
  });

  it("normalizes a cached GitHub repo with no topics", async () => {
    resourceHarness.repos.mockResolvedValue([
      {
        name: "Bare",
        full_name: "org/bare-cached",
        html_url: "https://github.com/org/bare-cached",
        stargazers_count: 1,
        language: "Go",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
        license: { spdx_id: "MIT" },
      },
    ]);
    await expect(loadResource({ kind: "gh", id: "org/bare-cached" })).resolves.toMatchObject({
      tags: [],
    });
  });

  it("normalizes a bare Hugging Face model with only a license tag", async () => {
    resourceHarness.models.mockResolvedValue({ items: [], truncated: false });
    resourceHarness.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "soloModel", tags: ["license:apache-2.0"] }), {
        status: 200,
      }),
    );
    await expect(loadResource({ kind: "model", id: "soloModel" })).resolves.toMatchObject({
      name: "soloModel",
      license: "Apache-2.0",
      topic: "",
      downloads: 0,
      likes: 0,
      sizeCategory: "",
      description: "",
    });
  });

  it("normalizes cached models and datasets", async () => {
    resourceHarness.models.mockResolvedValue({
      truncated: false,
      items: [
        {
          id: "org/model",
          name: "model",
          author: "org",
          url: "https://huggingface.co/org/model",
          task: "asr",
          library: "transformers",
          license: "apache-2.0",
          downloads: 10,
          likes: 2,
          tags: ["odia"],
          createdAt: "2025-01-01",
        },
      ],
    });
    await expect(loadResource({ kind: "model", id: "ORG/MODEL" })).resolves.toMatchObject({
      kind: "model",
      description: "",
      topic: "asr",
      sizeCategory: undefined,
    });

    resourceHarness.datasets.mockResolvedValue({
      truncated: false,
      items: [
        {
          id: "org/data",
          name: "data",
          author: "org",
          url: "https://huggingface.co/datasets/org/data",
          description: "Corpus",
          task: "translation",
          license: "cc-by-4.0",
          sizeCategory: "1K<n<10K",
          modalities: ["text"],
          downloads: 10,
          likes: 2,
          tags: ["odia"],
          createdAt: "2025-01-01",
        },
      ],
    });
    await expect(loadResource({ kind: "dataset", id: "org/data" })).resolves.toMatchObject({
      kind: "dataset",
      description: "Corpus",
      sizeCategory: "1K<n<10K",
      modalities: ["text"],
    });
  });

  it("fetches uncached Hugging Face details and handles non-OK responses", async () => {
    resourceHarness.models.mockResolvedValue({
      items: [
        {
          id: "totally/different",
          author: "totally",
          name: "different",
          url: "https://huggingface.co/totally/different",
          task: "x",
          library: "x",
          license: "",
          downloads: 0,
          likes: 0,
          tags: [],
          createdAt: "2025-01-01",
        },
      ],
      truncated: false,
    });
    resourceHarness.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "org/new-model",
          description: "Description",
          cardData: { license: ["mit", "apache-2.0"] },
          downloads: 8,
          likes: 1,
          tags: ["task_categories:generation", "modality:text", "size_categories:n<1K"],
          createdAt: "2025-01-01",
          lastModified: "2026-01-01",
        }),
        { status: 200 },
      ),
    );
    await expect(loadResource({ kind: "model", id: "org/new-model" })).resolves.toMatchObject({
      name: "new-model",
      license: "MIT",
      topic: "generation",
      downloads: 8,
      modalities: ["text"],
    });

    resourceHarness.datasets.mockResolvedValue({
      items: [
        {
          id: "totally/different",
          author: "totally",
          name: "different",
          url: "https://huggingface.co/datasets/totally/different",
          description: "",
          task: "x",
          license: "",
          sizeCategory: "",
          modalities: [],
          downloads: 0,
          likes: 0,
          tags: [],
          createdAt: "2025-01-01",
        },
      ],
      truncated: false,
    });
    resourceHarness.fetch.mockResolvedValueOnce(new Response("no", { status: 404 }));
    await expect(loadResource({ kind: "dataset", id: "org/missing" })).resolves.toBeNull();
  });

  it("defaults Hugging Face tags to an empty array when omitted", async () => {
    resourceHarness.datasets.mockResolvedValue({ items: [], truncated: false });
    resourceHarness.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "org/no-tags", cardData: { license: "mit" } }), {
        status: 200,
      }),
    );
    await expect(loadResource({ kind: "dataset", id: "org/no-tags" })).resolves.toMatchObject({
      tags: [],
      license: "MIT",
    });
  });

  it("sends an Authorization header when GITHUB_TOKEN is set", async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    vi.resetModules();
    try {
      const { loadResource: freshLoadResource } = await import("../src/lib/sources/resource");
      resourceHarness.repos.mockRejectedValue(new Error("offline"));
      resourceHarness.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "Repo",
            full_name: "org/repo",
            description: "d",
            stargazers_count: 1,
            language: "TS",
            license: { spdx_id: "MIT" },
            topics: [],
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          }),
          { status: 200 },
        ),
      );
      await freshLoadResource({ kind: "gh", id: "org/repo" });
      expect(resourceHarness.fetch.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer test-token",
      );
    } finally {
      process.env.GITHUB_TOKEN = originalToken;
      vi.resetModules();
    }
  });
});
