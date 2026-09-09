import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregate,
  fetchContributors,
  fetchRepoDetails,
  gh,
  ghHeaders,
  main,
  requireEnv,
  writeToKv,
} from "../scripts/sync-contributors";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(value === undefined ? "" : JSON.stringify(value), { status });

describe("contributor synchronization script", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("validates environment and creates authenticated GitHub headers", () => {
    vi.stubEnv("PRESENT_TOKEN", "secret");
    expect(requireEnv("PRESENT_TOKEN")).toBe("secret");
    expect(() => requireEnv("ABSENT_TOKEN")).toThrow("Missing required env var: ABSENT_TOKEN");
    expect(ghHeaders("abc")).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer abc",
    });
  });

  it("parses GitHub responses and handles empty or failed requests", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ value: 1 }))
        .mockResolvedValueOnce(jsonResponse(undefined))
        .mockResolvedValueOnce(jsonResponse({ message: "no" }, 404))
        .mockResolvedValueOnce(jsonResponse([{ login: "one" }]))
        .mockResolvedValueOnce(jsonResponse({ stargazers_count: 7, html_url: "https://repo" })),
    );

    await expect(gh<{ value: number }>("https://api.test/value", "token")).resolves.toEqual({
      value: 1,
    });
    await expect(gh("https://api.test/empty", "token")).resolves.toBeNull();
    await expect(gh("https://api.test/fail", "token")).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    await expect(fetchContributors("owner/repo", "token")).resolves.toEqual([{ login: "one" }]);
    await expect(fetchRepoDetails("owner/repo", "token")).resolves.toEqual({
      stars: 7,
      html_url: "https://repo",
    });
  });

  it("defaults to an empty contributor list when GitHub returns nothing usable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ message: "no" }, 404)));
    await expect(fetchContributors("owner/missing-repo", "token")).resolves.toEqual([]);
  });

  it("aggregates contributors across curated repositories and filters tiny contributions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/contributors")) {
          const contributors = [
            {
              login: "alice",
              avatar_url: "https://avatar/alice",
              html_url: "https://github.com/alice",
              contributions: 1,
            },
          ];
          if (url.includes("aidaybbsr2025demo")) {
            contributors.push({
              login: "small",
              avatar_url: "https://avatar/small",
              html_url: "https://github.com/small",
              contributions: 1,
            });
          }
          return jsonResponse(contributors);
        }
        if (url.includes("aidaybbsr2025demo")) return jsonResponse({ message: "missing" }, 404);
        return jsonResponse({
          stargazers_count: 3,
          html_url: url.replace("api.github.com/repos", "github.com"),
        });
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const payload = await aggregate("token");
    expect(payload.totalContributors).toBe(1);
    expect(payload.contributors[0]?.login).toBe("alice");
    expect(payload.contributors[0]?.contributions).toBeGreaterThan(10);
    expect(payload.contributors[0]?.repos.some((repo) => repo.stars === 0)).toBe(true);
    expect(payload.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sorts multiple qualifying contributors by descending contributions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/contributors")) {
          return jsonResponse([
            {
              login: "bob",
              avatar_url: "https://avatar/bob",
              html_url: "https://github.com/bob",
              contributions: 3,
            },
            {
              login: "carol",
              avatar_url: "https://avatar/carol",
              html_url: "https://github.com/carol",
              contributions: 1,
            },
          ]);
        }
        return jsonResponse({
          stargazers_count: 0,
          html_url: url.replace("api.github.com/repos", "github.com"),
        });
      }),
    );

    const payload = await aggregate("token");
    expect(payload.totalContributors).toBe(2);
    expect(payload.contributors[0]?.login).toBe("bob");
    expect(payload.contributors[1]?.login).toBe("carol");
    expect(payload.contributors[0]?.contributions).toBeGreaterThan(
      payload.contributors[1]?.contributions ?? 0,
    );
  });

  it("writes payloads to Workers KV and surfaces API failures", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token");
    vi.stubEnv("CONTRIBUTORS_KV_NAMESPACE_ID", "namespace");
    const payload = { contributors: [], totalContributors: 0, fetchedAt: "now" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(writeToKv(payload)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("accounts/account/storage/kv/namespaces/namespace"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify(payload) }),
    );
    await expect(writeToKv(payload)).rejects.toThrow("KV PUT failed: 403 denied");
  });

  it("executes the end-to-end synchronization entry point", async () => {
    vi.stubEnv("GITHUB_TOKEN", "github");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cloudflare");
    vi.stubEnv("CONTRIBUTORS_KV_NAMESPACE_ID", "namespace");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("cloudflare.com")) return jsonResponse({ success: true });
        if (url.includes("/contributors")) return jsonResponse([]);
        return jsonResponse({ stargazers_count: 0, html_url: "https://github.com/repo" });
      }),
    );

    await expect(main()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Aggregated 0 contributors"));
    expect(log).toHaveBeenCalledWith('Wrote KV key "contributors:v2".');
  });

  it("runs main() automatically when executed as the entry script", async () => {
    vi.stubEnv("GITHUB_TOKEN", "github");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cloudflare");
    vi.stubEnv("CONTRIBUTORS_KV_NAMESPACE_ID", "namespace");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("cloudflare.com")) return jsonResponse({ success: true });
        if (url.includes("/contributors")) return jsonResponse([]);
        return jsonResponse({ stargazers_count: 0, html_url: "https://github.com/repo" });
      }),
    );

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/sync-contributors.ts";
    vi.resetModules();
    try {
      await import("../scripts/sync-contributors");
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith('Wrote KV key "contributors:v2".'));
    } finally {
      process.argv[1] = previousArgv1;
    }
  });

  it("logs the error and exits 1 when main() rejects while executed as a script", async () => {
    // GITHUB_TOKEN is intentionally left unset so requireEnv() throws
    // synchronously inside main(), rejecting its returned promise.
    vi.stubEnv("GITHUB_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/sync-contributors.ts";
    vi.resetModules();
    try {
      await import("../scripts/sync-contributors");
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Missing required env var: GITHUB_TOKEN" }),
      );
    } finally {
      process.argv[1] = previousArgv1;
    }
  });
});
