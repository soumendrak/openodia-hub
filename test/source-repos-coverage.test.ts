import { afterEach, describe, expect, it, vi } from "vitest";

const repoHarness = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/lib/fetch-utils", () => ({
  fetchWithTimeout: repoHarness.fetch,
  mapWithConcurrency: async <T, R>(items: T[], _limit: number, worker: (item: T) => Promise<R>) =>
    Promise.all(items.slice(0, 3).map(worker)),
}));
vi.mock("../src/lib/sources/cache", () => ({
  cachedJson: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  UpstreamUnavailableError: class UpstreamUnavailableError extends Error {},
}));

import { licenseFromRepoFile, loadRepos } from "../src/lib/sources/repos";

afterEach(() => {
  repoHarness.fetch.mockReset();
  vi.restoreAllMocks();
});

describe("GitHub repository source adapter", () => {
  it("reads detected license files and handles unusable responses", async () => {
    repoHarness.fetch.mockResolvedValueOnce(new Response("no", { status: 404 }));
    await expect(licenseFromRepoFile("org/missing")).resolves.toBe("");
    repoHarness.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: "bad", encoding: "text" }), { status: 200 }),
    );
    await expect(licenseFromRepoFile("org/text")).resolves.toBe("");
    repoHarness.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: btoa("MIT License\nPermission is hereby granted, free of charge"),
          encoding: "base64",
        }),
        { status: 200 },
      ),
    );
    await expect(licenseFromRepoFile("org/mit")).resolves.toBe("MIT");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    repoHarness.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(licenseFromRepoFile("org/offline")).resolves.toBe("");
  });

  it("filters forks and archived repositories and sorts the survivors", async () => {
    const raw = (name: string, stars: number, extra: Record<string, unknown> = {}) => ({
      name,
      full_name: `org/${name}`,
      html_url: `https://github.com/org/${name}`,
      description: undefined,
      stargazers_count: stars,
      language: undefined,
      updated_at: "2026-01-01",
      created_at: "2025-01-01",
      fork: false,
      archived: false,
      license: { spdx_id: "MIT" },
      topics: undefined,
      ...extra,
    });
    repoHarness.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(raw("kept", 5)), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(raw("fork", 10, { fork: true })), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(raw("archived", 20, { archived: true })), { status: 200 }),
      );
    await expect(loadRepos()).resolves.toEqual([
      expect.objectContaining({
        name: "kept",
        description: null,
        language: null,
        topics: [],
      }),
    ]);
  });

  it("resolves NOASSERTION during list loading and rejects an empty result", async () => {
    repoHarness.fetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/license")
          ? new Response(
              JSON.stringify({
                content: btoa("SIL OPEN FONT LICENSE Version 1.1"),
                encoding: "base64",
              }),
              { status: 200 },
            )
          : new Response(
              JSON.stringify({
                name: "font",
                full_name: url.split("/repos/")[1],
                html_url: "https://github.com/org/font",
                description: "Font",
                stargazers_count: 1,
                language: "CSS",
                updated_at: "2026-01-01",
                created_at: "2025-01-01",
                fork: false,
                archived: false,
                license: { spdx_id: "NOASSERTION" },
                topics: [],
              }),
              { status: 200 },
            ),
      ),
    );
    const repos = await loadRepos();
    expect(repos[0].license).toEqual({ spdx_id: "OFL-1.1" });

    repoHarness.fetch.mockImplementation(() =>
      Promise.resolve(new Response("no", { status: 404 })),
    );
    await expect(loadRepos()).rejects.toThrow("github_unavailable");
  });

  it("recovers from a thrown repo fetch and resolves an unrecognised license file to no license", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    repoHarness.fetch.mockImplementation((url: string) => {
      // Every /license lookup here fails, so a NOASSERTION spdx_id must resolve to null.
      if (url.endsWith("/license")) return Promise.resolve(new Response("no", { status: 404 }));
      // The first pinned repo's own fetch throws outright — fetchSingleRepo must recover.
      if (url.includes("aidaybbsr2025demo")) return Promise.reject(new Error("network down"));
      const full_name = url.split("/repos/")[1];
      // The second pinned repo has no license at all: pickRepo must fall back to null.
      const license = full_name.endsWith("odia-2048") ? null : { spdx_id: "NOASSERTION" };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            name: full_name.split("/")[1],
            full_name,
            html_url: `https://github.com/${full_name}`,
            description: "d",
            stargazers_count: 1,
            language: "TS",
            updated_at: "2026-01-01",
            created_at: "2025-01-01",
            fork: false,
            archived: false,
            license,
            topics: [],
          }),
          { status: 200 },
        ),
      );
    });

    const repos = await loadRepos();
    expect(repos).toHaveLength(2);
    expect(repos.find((r) => r.full_name.endsWith("odia-2048"))?.license).toBeNull();
    expect(repos.find((r) => r.full_name.endsWith("openodia"))?.license).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("fetchSingleRepo"),
      expect.any(Error),
    );
  });

  it("adds a Bearer Authorization header when GITHUB_TOKEN is configured", async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    vi.resetModules();
    try {
      const { loadRepos: loadReposWithToken } = await import("../src/lib/sources/repos");
      const seenAuthHeaders: (string | undefined)[] = [];
      repoHarness.fetch.mockImplementation(
        (_url: string, init?: { headers?: Record<string, string> }) => {
          seenAuthHeaders.push(init?.headers?.Authorization);
          return Promise.resolve(new Response("no", { status: 404 }));
        },
      );

      await expect(loadReposWithToken()).rejects.toThrow("github_unavailable");
      expect(seenAuthHeaders.length).toBeGreaterThan(0);
      expect(seenAuthHeaders.every((h) => h === "Bearer test-token")).toBe(true);
    } finally {
      if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = originalToken;
      vi.resetModules();
    }
  });
});
