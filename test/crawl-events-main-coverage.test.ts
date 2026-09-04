import { afterEach, describe, expect, it, vi } from "vitest";

const crawlHarness = vi.hoisted(() => ({
  writes: [] as Array<[string, string]>,
  existsSync: vi.fn((path: string) => !path.includes("gdgoc-nist-berhampur.ts")),
  readFileSync: vi.fn(() => "export const events = [\n];\n"),
  writeFileSync: vi.fn((path: string, content: string) => {
    crawlHarness.writes.push([path, content]);
  }),
  resolveEventDestinationUrl: vi.fn(async (url: string) => url),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: crawlHarness.existsSync,
    readFileSync: crawlHarness.readFileSync,
    writeFileSync: crawlHarness.writeFileSync,
  },
  existsSync: crawlHarness.existsSync,
  readFileSync: crawlHarness.readFileSync,
  writeFileSync: crawlHarness.writeFileSync,
}));
vi.mock("../src/lib/event-url.ts", () => ({
  eventUrlKey: (url: string) => url.replace(/\/$/, "").replace(/\/cohost-[^/]+$/, ""),
  resolveEventDestinationUrl: crawlHarness.resolveEventDestinationUrl,
}));

const nextData = (events: unknown[]) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        prerenderData: {
          upcomingEvents: { results: events },
          pastEvents: { results: [] },
        },
      },
    },
  })}</script>`;

const gdgEvent = (title: string, url: string) => ({
  title,
  url,
  start_date: "2026-09-13T04:30:00Z",
  description_short: "Short description…",
});

describe("event crawler orchestration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    crawlHarness.writes.length = 0;
  });

  it("processes successes, duplicates, skipped events, empty pages, and source failures", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sharedUrl = "https://gdg.community.dev/events/details/shared-event/";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/events/details/")) {
          return new Response(
            `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
              props: {
                pageProps: {
                  eventData: {
                    start_date: "2026-09-13T04:30:00Z",
                    end_date: "2026-09-14T04:30:00Z",
                    event_timezone: "Asia/Kolkata",
                    description_short: "Truncated…",
                    description: "<p>Complete first sentence. Complete second sentence. Third.</p>",
                    venue_name: "  Community   Hall ",
                  },
                },
              },
            })}</script>`,
          );
        }
        if (url.includes("gdg-bhubaneswar")) {
          return new Response(nextData([gdgEvent("AI Workshop", sharedUrl)]));
        }
        if (url.includes("national-institute-of-science")) {
          return new Response(
            nextData([
              gdgEvent("Campus Hackathon", "https://gdg.community.dev/events/details/nist/"),
            ]),
          );
        }
        if (url.includes("kalinga-institute")) {
          return new Response(nextData([gdgEvent("Renamed duplicate", sharedUrl)]));
        }
        if (url.includes("c-v-raman")) {
          return new Response(
            nextData([
              gdgEvent("Orientation", "https://gdg.community.dev/events/details/orientation/"),
            ]),
          );
        }
        if (url.includes("international-institute")) return new Response(nextData([]));
        if (url.includes("institute-of-technical")) return new Response("changed markup");
        if (url.includes("veer-surendra")) return new Response("gone", { status: 404 });
        if (url.includes("national-institute-of-technology")) {
          return new Response("temporary", { status: 503 });
        }
        if (url === "https://www.odishaai.org/conferences/") {
          return new Response('<script src="/assets/index-test.js"></script>');
        }
        if (url.endsWith("/assets/index-test.js")) {
          return new Response(
            "{slug:`odia-conf`,title:`Odisha AI Conference`,date:`10 Oct 2026`,location:`Bhubaneswar`,desc:`Community conference`,cover:`conference-covers`}",
          );
        }
        if (url.endsWith("workshop-2023")) {
          return new Response("<h1>OdiaGenAI Workshop – 2023</h1><p>10th Dec 2023</p>");
        }
        if (url.includes("workshop-")) return new Response("missing", { status: 404 });
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await expect(main()).resolves.toBe(1);
    expect(crawlHarness.writes.length).toBeGreaterThan(1);
    expect(
      crawlHarness.writes.some(([, content]) => content.includes("Complete first sentence")),
    ).toBe(true);
    expect(crawlHarness.writes.some(([, content]) => content.includes('type: "Conference"'))).toBe(
      true,
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("No new events"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Parse failed"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("permanently"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("transient"));
  });

  const notFound = () => new Response("not found", { status: 404 });
  // A network-level failure (not an HTTP error response) is always transient,
  // so it never inflates `fatalFailures` — useful as a harmless catch-all for
  // sources this test isn't exercising.
  const transientFail = () => {
    throw new Error("network unreachable");
  };

  it("leaves an event unchanged when its detail page has no data, and logs when the detail fetch fails outright", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("gdg-bhubaneswar") && !url.includes("/events/details/")) {
          return new Response(
            nextData([
              gdgEvent(
                "Malformed Detail Event",
                "https://gdg.community.dev/events/details/malformed/",
              ),
            ]),
          );
        }
        if (url.includes("national-institute-of-science") && !url.includes("/events/details/")) {
          return new Response(
            nextData([
              gdgEvent(
                "Network Fail Detail Event",
                "https://gdg.community.dev/events/details/networkfail/",
              ),
            ]),
          );
        }
        if (url.includes("/events/details/malformed/")) {
          return new Response("<html><body>no NEXT_DATA here</body></html>");
        }
        if (url.includes("/events/details/networkfail/")) {
          throw new Error("connection reset");
        }
        transientFail();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await main();

    expect(
      crawlHarness.writes.some(([, content]) => content.includes("Malformed Detail Event")),
    ).toBe(true);
    expect(error.mock.calls.some(([msg]) => String(msg).includes("detail enrich failed"))).toBe(
      true,
    );
    expect(error.mock.calls.some(([msg]) => String(msg).includes("connection reset"))).toBe(true);
    expect(log).toHaveBeenCalled();
  });

  it("throws a ParseError when the odishaai JS bundle cannot be located", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://www.odishaai.org/conferences/") {
          return new Response("<html><body>no bundle script here</body></html>");
        }
        return notFound();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await expect(main()).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("JS bundle <script src> not found in shell"),
    );
  });

  it("throws a ParseError when no conference objects can be extracted from the bundle", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://www.odishaai.org/conferences/") {
          return new Response('<script src="/assets/index-empty.js"></script>');
        }
        if (url.endsWith("/assets/index-empty.js")) {
          // Neither chunk carries both the cover-image and location markers,
          // so parseOdishaAIEvents extracts zero conference objects.
          return new Response(
            "{slug:`conf-c`,title:`Conference C`,date:`5 May 2025`,desc:`Desc C`}" +
              "{slug:`conf-d`,location:`City D`,date:`6 Jun 2025`,desc:`Desc D`}",
          );
        }
        return notFound();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await expect(main()).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("no conference objects extracted from bundle"),
    );
  });

  it("extracts odishaai conferences while skipping malformed chunks and handling year-only/absent dates", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "https://www.odishaai.org/conferences/") {
          return new Response('<script src="/assets/index-mixed.js"></script>');
        }
        if (url.endsWith("/assets/index-mixed.js")) {
          const blocks = [
            // No `date:` field at all.
            "{slug:`conf-a`,title:`Conference A`,location:`City A`,desc:`Desc A`,cover:`conference-covers`}",
            // Year-only date (no month name).
            "{slug:`conf-b`,title:`Conference B`,date:`2024`,location:`City B`,desc:`Desc B`,cover:`conference-covers`}",
            // Missing the `location:` marker — must be skipped entirely.
            "{slug:`conf-c`,title:`Conference C`,date:`5 May 2025`,desc:`Desc C`,cover:`conference-covers`}",
            // Has the markers but no `title:` field — must be skipped entirely.
            "{slug:`conf-d`,location:`City D`,date:`6 Jun 2025`,desc:`Desc D`,cover:`conference-covers`}",
            // Date with neither a month name nor a 4-digit year.
            "{slug:`conf-e`,title:`Conference E`,date:`--`,location:`City E`,desc:`Desc E`,cover:`conference-covers`}",
            // Contains a letter (so it's routed through the full date parser)
            // but isn't a real date, so `new Date(...)` yields an invalid date.
            "{slug:`conf-f`,title:`Conference F`,date:`TBD`,location:`City F`,desc:`Desc F`,cover:`conference-covers`}",
            // No `desc:` field at all.
            "{slug:`conf-g`,title:`Conference G`,date:`7 Jul 2025`,location:`City G`,cover:`conference-covers`}",
          ];
          return new Response(blocks.join(""));
        }
        return notFound();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await main();

    const written = crawlHarness.writes.map(([, content]) => content).join("\n");
    expect(written).toContain("Conference A");
    expect(written).toContain("Conference B");
    expect(written).toContain("Conference E");
    expect(written).toContain("Conference F");
    expect(written).toContain("Conference G");
    expect(written).not.toContain("Conference C");
    expect(written).not.toContain("Conference D");
    expect(log).toHaveBeenCalled();
  });

  it("resolves redirected destination URLs, rewrites changed ones, and leaves unchanged ones alone", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    crawlHarness.existsSync.mockImplementation(() => true);
    crawlHarness.readFileSync.mockImplementation(
      () =>
        'export const events: Omit<Event, "id">[] = [\n' +
        '  { url: "https://old.example.com/a/" },\n' +
        '  { url: "https://same.example.com/b/" },\n' +
        '  { url: "https://unresolvable.example.com/c/" },\n' +
        "];\n",
    );
    crawlHarness.resolveEventDestinationUrl.mockImplementation(async (url: string) => {
      if (url.includes("old.example.com")) return "https://new.example.com/a";
      // An edge case where resolution comes back empty/falsy — the original
      // URL must be kept rather than corrupting the file with an empty string.
      if (url.includes("unresolvable.example.com")) return "";
      return url;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => notFound()),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await main();

    expect(crawlHarness.writes.length).toBeGreaterThan(0);
    const [, content] = crawlHarness.writes[0]!;
    expect(content).toContain("https://new.example.com/a");
    expect(content).not.toContain("https://old.example.com/a/");
    expect(content).toContain("https://same.example.com/b/");
    expect(content).toContain("https://unresolvable.example.com/c/");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("destination updated"));
  });

  it("reports when no array literal can be located, and falls back to the final all-clear summary", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    crawlHarness.readFileSync.mockImplementation((path: string) =>
      path.includes("gdg-bhubaneswar")
        ? "export const events = EMPTY_ARRAY_PLACEHOLDER;\n"
        : "export const events = [\n];\n",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("gdg-bhubaneswar") && !url.includes("/events/details/")) {
          return new Response(
            nextData([
              gdgEvent(
                "Unplaceable Event",
                "https://gdg.community.dev/events/details/unplaceable/",
              ),
            ]),
          );
        }
        if (url.includes("/events/details/")) {
          return new Response("<html><body>no NEXT_DATA</body></html>");
        }
        transientFail();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await expect(main()).resolves.toBe(0);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Could not locate array literal"));
    expect(log).toHaveBeenCalledWith("✓ No new events found anywhere");
  });

  it("enriches from a bare detail page (no timezone/end-date/description/venue) and inserts into a non-empty array", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    crawlHarness.readFileSync.mockImplementation((path: string) =>
      path.includes("gdg-bhubaneswar")
        ? 'export const events = [\n  { title: "Existing Event", url: "https://gdg.community.dev/events/details/existing/" },\n];\n'
        : "export const events = [\n];\n",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("gdg-bhubaneswar") && !url.includes("/events/details/")) {
          return new Response(
            nextData([
              {
                title: "Bare Detail Event",
                url: "https://gdg.community.dev/events/details/bare/",
                start_date: "2026-09-13T04:30:00Z",
              },
            ]),
          );
        }
        if (url.includes("/events/details/bare/")) {
          // Only start_date is present — no event_timezone, end_date,
          // description(_short), or venue_name.
          return new Response(
            `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
              props: { pageProps: { eventData: { start_date: "2026-09-13T04:30:00Z" } } },
            })}</script>`,
          );
        }
        transientFail();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await main();

    const written =
      crawlHarness.writes.find(([path]) => path.includes("gdg-bhubaneswar"))?.[1] ?? "";
    expect(written).toContain("// auto-crawled");
    expect(written).toContain("Existing Event");
    expect(written).toContain("Bare Detail Event");
    expect(written).not.toMatch(/Bare Detail Event[\s\S]*?description:/);
    expect(log).toHaveBeenCalled();
  });

  it("falls back to the <title> tag and a missing date when an OdiaGenAI workshop page has no <h1> or date text", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("workshop-2023")) {
          return new Response("<title>Untitled Gathering</title><p>date to be announced</p>");
        }
        if (url.includes("workshop-")) return notFound();
        transientFail();
      }),
    );

    const { main } = await import("../scripts/crawl-events.mjs");
    await main();

    const written = crawlHarness.writes.map(([, content]) => content).join("\n");
    expect(written).toContain("Untitled Gathering");
    expect(log).toHaveBeenCalled();
  });

  it("runs main() to completion and calls process.exit with its resolved code when executed as a script", async () => {
    vi.resetModules();
    crawlHarness.existsSync.mockImplementation(() => false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        transientFail();
      }),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/crawl-events.mjs";
    try {
      await import("../scripts/crawl-events.mjs");
      await vi.waitFor(() => expect(exit).toHaveBeenCalled());
      expect(exit).toHaveBeenCalledWith(0);
    } finally {
      process.argv[1] = previousArgv1;
    }
  });

  it("logs FATAL and exits 1 when main() rejects while executed as a script", async () => {
    vi.resetModules();
    crawlHarness.existsSync.mockImplementation(() => true);
    crawlHarness.readFileSync.mockImplementation(() => {
      throw new Error("disk unavailable");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/crawl-events.mjs";
    try {
      await import("../scripts/crawl-events.mjs");
      await vi.waitFor(() => expect(exit).toHaveBeenCalled());
      expect(error).toHaveBeenCalledWith("FATAL:", "disk unavailable");
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      process.argv[1] = previousArgv1;
    }
  });
});
