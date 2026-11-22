import { afterEach, describe, expect, it, vi } from "vitest";

import { checkOne, loadSkipPatterns, main, skipPatterns } from "../scripts/check-links.mjs";

const response = (status: number, body = "") =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

const README = "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/README.md";
const CONFIG =
  "https://raw.githubusercontent.com/odisha-ml/Awesome-Odia-AI/main/.markdown-link-check.json";

const byMethod = (head: number, get: number) =>
  vi.fn(async (_url: string, init: { method: string }) =>
    response(init.method === "HEAD" ? head : get),
  );

const stubExit = () =>
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);

const runMain = async (
  readme: string,
  configBody: string,
  links: (url: string) => number,
  json = false,
) => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  stubExit();
  const fetchMock = vi.fn(async (url: string) => {
    if (url === README) return response(200, readme);
    if (url === CONFIG) return response(200, configBody);
    return response(links(url));
  });
  vi.stubGlobal("fetch", fetchMock);
  const previousArgv = process.argv;
  process.argv = json
    ? [...previousArgv.filter((arg) => arg !== "--json"), "--json"]
    : previousArgv.filter((arg) => arg !== "--json");
  const outcome = await main().catch((err: Error) => err.message);
  process.argv = previousArgv;
  const checked = fetchMock.mock.calls
    .map((call) => call[0])
    .filter((url) => url !== README && url !== CONFIG);
  return {
    outcome,
    checked: [...new Set(checked)],
    lines: log.mock.calls.map((call) => String(call[0])),
    errors: error.mock.calls.map((call) => String(call[0])),
  };
};

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

  it("counts a link that answers 403 to HEAD and GET as restricted, not dead", async () => {
    vi.stubGlobal("fetch", byMethod(403, 403));

    await expect(checkOne("https://example.com/gated")).resolves.toEqual({
      url: "https://example.com/gated",
      ok: true,
      status: 403,
      restricted: true,
    });
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
        .mockResolvedValueOnce(
          response(200, "[t](https://tdil-dc.in/x) [l](https://example.com/live)"),
        )
        .mockResolvedValueOnce(config(["^https://tdil-dc\\.in"]))
        .mockResolvedValueOnce(response(200)),
    );

    const previousArgv = process.argv;
    process.argv = [...previousArgv, "--json"];
    await expect(main()).rejects.toThrow("exit:0");
    process.argv = previousArgv;

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      checked: 1,
      dead: [],
      restricted: [],
      rateLimited: [],
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

  it("retries with GET when a normal host answers HEAD with 429", async () => {
    vi.useFakeTimers();
    const fetchMock = byMethod(429, 200);
    vi.stubGlobal("fetch", fetchMock);

    const pending = checkOne("https://example.com/head-429");
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({
      url: "https://example.com/head-429",
      ok: true,
      status: 200,
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "GET"]);
  });

  it("does not retry with GET after HEAD 399", async () => {
    const fetchMock = byMethod(399, 200);
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkOne("https://example.com/odd")).resolves.toMatchObject({
      ok: false,
      reason: "HTTP 399",
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD"]);
  });

  it.each([428, 430])("reports a final %i as dead, not rate limited", async (status) => {
    vi.stubGlobal("fetch", byMethod(status, status));

    await expect(checkOne("https://example.com/near-429")).resolves.toEqual({
      url: "https://example.com/near-429",
      ok: false,
      status,
      reason: `HTTP ${status}`,
    });
  });

  it("matches skip patterns exactly as markdown-link-check does", async () => {
    const base = "https://skip.test";
    const readme = [
      `${base}/skipme/1`,
      `${base}/skipme/2`,
      `${base}/skipme/3`,
      `${base}/SKIPME/9`,
      `https://other.test/x?u=${base}/skipme`,
      "https://other.test/live",
      "https://other.test/deep/mid-skip/page",
      "https://b.test/alt",
    ]
      .map((url, i) => `[l${i}](${url})`)
      .join(" ");
    const run = await runMain(
      readme,
      JSON.stringify({
        ignorePatterns: [
          { pattern: "^https://skip\\.test/skipme" },
          { pattern: "/mid-skip/" },
          { pattern: "^https://(a|b)\\.test/" },
        ],
      }),
      () => 200,
    );

    expect(run.outcome).toBe("exit:0");
    expect(run.checked).toEqual([
      `${base}/SKIPME/9`,
      `https://other.test/x?u=${base}/skipme`,
      "https://other.test/live",
    ]);
    expect(run.lines).toContain("\n5 link(s) skipped by the Awesome-Odia-AI link-check config:");
  });

  it("lists links that stay rate limited in the text report", async () => {
    vi.useFakeTimers();
    const pending = runMain("[a](https://busy.test/a) [b](https://ok.test/b)", "{}", (url) =>
      url.startsWith("https://busy.test") ? 429 : 200,
    );
    await vi.advanceTimersByTimeAsync(3000);
    const run = await pending;

    expect(run.outcome).toBe("exit:0");
    expect(run.lines).toEqual([
      "Checking 2 links…",
      "All 2 links resolve.",
      "\n1 link(s) stayed rate limited (HTTP 429) and count as alive:",
      "  https://busy.test/a",
    ]);
  });

  it("lists links that stay rate limited in the JSON report", async () => {
    vi.useFakeTimers();
    const pending = runMain(
      "[a](https://busy.test/a) [b](https://ok.test/b)",
      "{}",
      (url) => (url.startsWith("https://busy.test") ? 429 : 200),
      true,
    );
    await vi.advanceTimersByTimeAsync(3000);
    const run = await pending;

    expect(run.outcome).toBe("exit:0");
    expect(run.lines).toHaveLength(1);
    expect(JSON.parse(run.lines[0] ?? "")).toEqual({
      checked: 2,
      dead: [],
      restricted: [],
      rateLimited: [{ url: "https://busy.test/a", ok: true, status: 429, rateLimited: true }],
      skipped: [],
    });
  });

  it("accepts a config without ignorePatterns", () => {
    expect(skipPatterns({ aliveStatusCodes: [200] })).toEqual([]);
  });

  it.each([
    [
      "a string entry",
      { ignorePatterns: ["^nomatch"] },
      'ignorePatterns[0] needs a non-empty string "pattern": "^nomatch"',
    ],
    [
      "an empty pattern",
      { ignorePatterns: [{ pattern: "" }] },
      'ignorePatterns[0] needs a non-empty string "pattern": {"pattern":""}',
    ],
    [
      "a null entry",
      { ignorePatterns: [{ pattern: "^a" }, null] },
      'ignorePatterns[1] needs a non-empty string "pattern": null',
    ],
    [
      "a numeric pattern",
      { ignorePatterns: [{ pattern: 5 }] },
      'ignorePatterns[0] needs a non-empty string "pattern": {"pattern":5}',
    ],
    [
      "an invalid regex",
      { ignorePatterns: [{ pattern: "(unclosed" }] },
      "ignorePatterns[0] is not a valid regular expression: (unclosed",
    ],
    [
      "a non-array ignorePatterns",
      { ignorePatterns: { pattern: "^a" } },
      "ignorePatterns is not an array",
    ],
    ["a null ignorePatterns", { ignorePatterns: null }, "ignorePatterns is not an array"],
    [
      "an undefined ignorePatterns",
      { ignorePatterns: undefined },
      "ignorePatterns is not an array",
    ],
    ["a false ignorePatterns", { ignorePatterns: false }, "ignorePatterns is not an array"],
    ["a zero ignorePatterns", { ignorePatterns: 0 }, "ignorePatterns is not an array"],
    ["an empty-string ignorePatterns", { ignorePatterns: "" }, "ignorePatterns is not an array"],
    ["a null config", null, "the config is not a JSON object"],
    ["an array config", [], "the config is not a JSON object"],
    ["a string config", "x", "the config is not a JSON object"],
  ])("rejects %s", (_name, value, message) => {
    const thrown = (() => {
      try {
        skipPatterns(value);
      } catch (err) {
        return [String(err), (err as Error).message];
      }
      return ["no error", "no error"];
    })();
    expect(thrown).toEqual([`Error: ${message}`, message]);
  });

  const parseError = (() => {
    try {
      JSON.parse("{not json");
    } catch (err) {
      return String(err);
    }
    return "parsed";
  })();

  const resetMidBody = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ignorePat'));
          controller.error(new TypeError("ECONNRESET: socket closed"));
        },
      }),
      { status: 200 },
    );

  it.each([
    ["invalid JSON", () => response(200, "{not json"), `it is not valid JSON: ${parseError}`],
    ["a null body", () => response(200, "null"), "the config is not a JSON object"],
    [
      "an invalid regex",
      () => config(["(unclosed"]),
      "ignorePatterns[0] is not a valid regular expression: (unclosed",
    ],
    [
      "a string entry",
      () => response(200, '{"ignorePatterns":["^nomatch"]}'),
      'ignorePatterns[0] needs a non-empty string "pattern": "^nomatch"',
    ],
    [
      "an empty pattern",
      () => config([""]),
      'ignorePatterns[0] needs a non-empty string "pattern": {"pattern":""}',
    ],
    [
      "a null ignorePatterns",
      () => response(200, '{"ignorePatterns":null}'),
      "ignorePatterns is not an array",
    ],
    ["HTTP 404", () => response(404), "it could not be fetched: HTTP 404"],
    ["HTTP 500", () => response(500), "it could not be fetched: HTTP 500"],
    [
      "a network error",
      () => Promise.reject(new TypeError("fetch failed")),
      "it could not be fetched: TypeError: fetch failed",
    ],
    [
      "a connection reset mid-body",
      resetMidBody,
      "it could not be fetched: TypeError: ECONNRESET: socket closed",
    ],
  ])("exits 2 with a message when the config has %s", async (_name, configResponse, message) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    stubExit();
    const fetchMock = vi.fn(async (url: string) =>
      url === CONFIG ? configResponse() : response(200, "[l](https://example.com/live)"),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(main()).rejects.toThrow("exit:2");
    expect(error.mock.calls).toEqual([
      [`Could not use the Awesome-Odia-AI link-check config: ${message}`],
    ]);
    expect(log).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([README, CONFIG]);
  });

  it("loads compiled patterns from the config URL", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(config(["^https://a\\.test"]));
    vi.stubGlobal("fetch", fetchMock);

    const patterns = await loadSkipPatterns();
    expect(patterns.map((pattern: RegExp) => [pattern.source, pattern.flags])).toEqual([
      ["^https:\\/\\/a\\.test", ""],
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(CONFIG);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { "User-Agent": expect.stringContaining("openodia.com link checker") },
    });
  });

  it("exits 2 when the README lists no links", async () => {
    const run = await runMain("no links here", "{}", () => 200);

    expect(run.outcome).toBe("exit:2");
    expect(run.errors).toEqual([
      "The Awesome-Odia-AI README lists no links, so nothing would be checked.",
    ]);
    expect(run.lines).toEqual([]);
  });

  it("waits and retries when HEAD and GET both answer 429, then accepts a later 200", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    const pending = checkOne("https://example.com/slow-down");
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({
      url: "https://example.com/slow-down",
      ok: true,
      status: 200,
    });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "GET", "HEAD"]);
  });

  it.each([
    ["a network error", () => Promise.reject(new TypeError("fetch failed")), "fetch failed"],
    ["HTTP 503", () => response(503), "HTTP 503"],
    ["a connection reset mid-body", resetMidBody, "ECONNRESET: socket closed"],
  ])("exits 2 when the README request fails with %s", async (_name, readmeResponse, cause) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubExit();
    const fetchMock = vi.fn(async () => readmeResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(main()).rejects.toThrow("exit:2");
    expect(error.mock.calls).toEqual([[`Could not fetch the Awesome-Odia-AI README: ${cause}`]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts any 2xx answer for the README and the config", async () => {
    const run = await runMain("[l](https://example.com/live)", "{}", () => 200);
    expect(run.outcome).toBe("exit:0");

    const fetchMock = vi.fn(async (url: string) =>
      url === CONFIG
        ? new Response('{"ignorePatterns":[{"pattern":"^https://tdil"}]}', { status: 203 })
        : url === README
          ? new Response("[l](https://example.com/live) [t](https://tdil.test/x)", { status: 203 })
          : response(200),
    );
    vi.stubGlobal("fetch", fetchMock);
    stubExit();
    await expect(main()).rejects.toThrow("exit:0");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      README,
      CONFIG,
      "https://example.com/live",
    ]);
  });

  it("exits 2 instead of passing when the config skips every listed link", async () => {
    const run = await runMain(
      "[a](https://a.test/1) [b](https://a.test/2)",
      JSON.stringify({ ignorePatterns: [{ pattern: "^https://" }] }),
      () => 200,
    );

    expect(run.outcome).toBe("exit:2");
    expect(run.checked).toEqual([]);
    expect(run.errors).toEqual([
      "The Awesome-Odia-AI link-check config skips all 2 listed links, so nothing would be checked.",
    ]);
  });
});
