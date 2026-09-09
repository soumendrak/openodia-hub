import { afterEach, describe, expect, it, vi } from "vitest";

import { checkOne, extractUrls, main, mapWithConcurrency } from "../scripts/check-links.mjs";

const response = (status: number, body = "") =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

describe("link checker script", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("extracts unique, trimmed markdown URLs and maps with bounded workers", async () => {
    expect(
      extractUrls(
        "[one](https://example.com/a), [two](https://example.com/a) [b](http://b.test/x;).",
      ),
    ).toEqual(["https://example.com/a", "http://b.test/x"]);
    await expect(mapWithConcurrency([1, 2, 3], 2, async (value) => value * 2)).resolves.toEqual([
      2, 4, 6,
    ]);
    await expect(mapWithConcurrency([], 2, async (value) => value)).resolves.toEqual([]);
  });

  it("handles live, restricted, GET-only, HEAD fallback, dead, and retried links", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(405))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(404))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(response(202));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://example.com/live")).resolves.toEqual({
      url: "https://example.com/live",
      ok: true,
      status: 200,
    });
    await checkOne("https://huggingface.co/model");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
    await expect(checkOne("https://example.com/head-blocked")).resolves.toMatchObject({ ok: true });
    await expect(checkOne("not a url")).resolves.toMatchObject({
      ok: true,
      restricted: true,
      status: 401,
    });
    await expect(checkOne("https://example.com/dead")).resolves.toMatchObject({
      ok: false,
      reason: "HTTP 404",
    });
    await expect(checkOne("https://example.com/retry")).resolves.toMatchObject({
      ok: true,
      status: 202,
    });
  });

  it("reports terminal request failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(checkOne("https://example.com")).resolves.toMatchObject({
      ok: false,
      status: 0,
      reason: "Error: offline",
    });
  });

  it("aborts a hung request once the timeout elapses and reports it as a timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );

    const pending = checkOne("https://example.com/hangs");
    // RETRIES=1, so the request stalls (and times out) on both attempts.
    await vi.advanceTimersByTimeAsync(15000);
    await vi.advanceTimersByTimeAsync(15000);

    await expect(pending).resolves.toMatchObject({ ok: false, status: 0, reason: "timeout" });
    vi.useRealTimers();
  });

  it("waits out a 429 rate limit and succeeds on retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response(429)).mockResolvedValueOnce(response(200)),
    );

    const pending = checkOne("https://example.com/rate-limited");
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({
      url: "https://example.com/rate-limited",
      ok: true,
      status: 200,
    });
    vi.useRealTimers();
  });

  it("runs JSON and human-readable reports with their documented exit codes", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, "[ok](https://example.com)"))
        .mockResolvedValueOnce(response(200)),
    );
    const previousArgv = process.argv;
    process.argv = [...previousArgv, "--json"];
    await expect(main()).rejects.toThrow("exit:0");
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"checked": 1'));

    process.argv = previousArgv;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(503)));
    await expect(main()).rejects.toThrow("exit:2");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));

    exit.mockRestore();
    process.argv = previousArgv;
  });

  it("prints a human-readable summary when every link resolves", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response(200, "[a](https://example.com/a) [b](https://example.com/b)"),
        )
        .mockResolvedValueOnce(response(200))
        .mockResolvedValueOnce(response(200)),
    );

    const previousArgv = process.argv;
    process.argv = previousArgv.filter((arg) => arg !== "--json");
    await expect(main()).rejects.toThrow("exit:0");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Checking 2 links"));
    expect(log).toHaveBeenCalledWith("All 2 links resolve.");

    exit.mockRestore();
    process.argv = previousArgv;
  });

  it("prints a human-readable summary of dead and restricted links", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response(200, "[dead](https://example.com/dead) [gated](https://example.com/gated)"),
        )
        .mockResolvedValueOnce(response(404))
        .mockResolvedValueOnce(response(401)),
    );

    const previousArgv = process.argv;
    process.argv = previousArgv.filter((arg) => arg !== "--json");
    await expect(main()).rejects.toThrow("exit:1");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Checking 2 links"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1 of 2 links are dead"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("HTTP 404"));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("link(s) exist but require authentication"),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("HTTP 401"));

    exit.mockRestore();
    process.argv = previousArgv;
  });

  it("runs main() automatically when executed as the entry script", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(200, "")));

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/check-links.mjs";
    vi.resetModules();
    try {
      await import("../scripts/check-links.mjs");
      expect(exit).toHaveBeenCalledWith(0);
    } finally {
      process.argv[1] = previousArgv1;
    }
  });
});
