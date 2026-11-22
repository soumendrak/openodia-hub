import { afterEach, describe, expect, it, vi } from "vitest";

import { checkOne, main, skipPatterns } from "../scripts/check-links.mjs";

const response = (status: number, body = "") =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

const config = (patterns: string[]) =>
  response(200, JSON.stringify({ ignorePatterns: patterns.map((pattern) => ({ pattern })) }));

describe("link checker false alarms", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries with GET when HEAD answers 404 and the page is live", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://www.kaggle.com/datasets/a/b")).resolves.toEqual({
      url: "https://www.kaggle.com/datasets/a/b",
      ok: true,
      status: 200,
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "GET"]);
  });

  it.each([400, 410, 499])("retries with GET after HEAD %i", async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(status))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://example.com/page")).resolves.toMatchObject({
      ok: true,
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([500, 503])("does not retry with GET after HEAD %i", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(response(status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://example.com/down")).resolves.toMatchObject({
      ok: false,
      reason: `HTTP ${status}`,
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD"]);
  });

  it("does not repeat a GET for hosts that are already checked with GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://huggingface.co/gone")).resolves.toMatchObject({ ok: false });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["GET"]);
  });

  it("still reports a link dead when HEAD and GET both answer 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://example.com/gone")).resolves.toEqual({
      url: "https://example.com/gone",
      ok: false,
      status: 404,
      reason: "HTTP 404",
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "GET"]);
  });

  it("counts a link that is still rate limited after the retry as alive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429)));

    const pending = checkOne("https://huggingface.co/busy");
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({
      url: "https://huggingface.co/busy",
      ok: true,
      status: 429,
      rateLimited: true,
    });
  });

  it("reads skip patterns from the list's link-check config", () => {
    const patterns = skipPatterns({ ignorePatterns: [{ pattern: "^https://tdil-dc\\.in" }] });
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.test("https://tdil-dc.in/index.php?lang=en")).toBe(true);
    expect(patterns[0]?.test("https://example.com/?u=https://tdil-dc.in")).toBe(false);
    expect(skipPatterns({})).toEqual([]);
  });

  it("skips links the config ignores and checks the rest", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, "[t](https://tdil-dc.in/x) [l](https://example.com/live)"),
      )
      .mockResolvedValueOnce(config(["^https://tdil-dc\\.in"]))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    const previousArgv = process.argv;
    process.argv = previousArgv.filter((arg) => arg !== "--json");
    await expect(main()).rejects.toThrow("exit:0");
    process.argv = previousArgv;

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/README.md",
      "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/.markdown-link-check.json",
      "https://example.com/live",
    ]);
    expect(log).toHaveBeenCalledWith("Checking 1 links…");
    expect(log).toHaveBeenCalledWith(
      "\n1 link(s) skipped by the Awesome-Odia-AI link-check config:",
    );
    expect(log).toHaveBeenCalledWith("  https://tdil-dc.in/x");
    expect(log).toHaveBeenCalledWith("All 1 links resolve.");
    exit.mockRestore();
  });

  it("lists skipped links in the JSON report", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, "[t](https://tdil-dc.in/x)"))
        .mockResolvedValueOnce(config(["^https://tdil-dc\\.in"])),
    );

    const previousArgv = process.argv;
    process.argv = [...previousArgv, "--json"];
    await expect(main()).rejects.toThrow("exit:0");
    process.argv = previousArgv;

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      checked: 0,
      dead: [],
      restricted: [],
      skipped: ["https://tdil-dc.in/x"],
    });
    exit.mockRestore();
  });

  it("prints no skip section when the config skips nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, "[l](https://example.com/live)"))
        .mockResolvedValueOnce(config(["^https://tdil-dc\\.in"]))
        .mockResolvedValueOnce(response(200)),
    );

    const previousArgv = process.argv;
    process.argv = previousArgv.filter((arg) => arg !== "--json");
    await expect(main()).rejects.toThrow("exit:0");
    process.argv = previousArgv;

    expect(log.mock.calls.map((call) => String(call[0]))).toEqual([
      "Checking 1 links…",
      "All 1 links resolve.",
    ]);
  });

  it("exits 2 when the link-check config cannot be fetched", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response(200, "")).mockResolvedValueOnce(response(404)),
    );

    await expect(main()).rejects.toThrow("exit:2");
    expect(error).toHaveBeenCalledWith(
      "Could not fetch the Awesome-Odia-AI link-check config: HTTP 404",
    );
  });
});
