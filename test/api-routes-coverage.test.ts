import { afterEach, describe, expect, it, vi } from "vitest";

const apiHarness = vi.hoisted(() => ({
  awesome: vi.fn(),
  datasets: vi.fn(),
  models: vi.fn(),
  repos: vi.fn(),
  catalog: vi.fn(),
  queryCatalog: vi.fn(),
  videos: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("../src/lib/sources/awesome", () => ({ loadAwesome: apiHarness.awesome }));
vi.mock("../src/lib/sources/huggingface", () => ({
  loadDatasets: apiHarness.datasets,
  loadModels: apiHarness.models,
}));
vi.mock("../src/lib/sources/repos", () => ({ loadRepos: apiHarness.repos }));
vi.mock("../src/lib/sources/catalog", () => ({
  loadCatalog: apiHarness.catalog,
  queryCatalog: apiHarness.queryCatalog,
}));
vi.mock("../src/lib/sources/videos", () => ({ loadVideos: apiHarness.videos }));
vi.mock("../src/lib/fetch-utils", () => ({ fetchWithTimeout: apiHarness.fetchWithTimeout }));

type ApiRoute = {
  options: { server: { handlers: { GET: (input?: { request: Request }) => Promise<Response> } } };
};

function getHandler(route: unknown) {
  return (route as ApiRoute).options.server.handlers.GET;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("simple public API routes", () => {
  it("returns awesome and repos payloads and their unavailable responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const awesome = await import("../src/routes/api/awesome");
    const repos = await import("../src/routes/api/repos");

    apiHarness.awesome.mockResolvedValueOnce([{ name: "Tool" }]);
    expect(await (await getHandler(awesome.Route)()).json()).toEqual({ items: [{ name: "Tool" }] });
    apiHarness.awesome.mockRejectedValueOnce(new Error("offline"));
    const awesomeFailure = await getHandler(awesome.Route)();
    expect(awesomeFailure.status).toBe(503);

    apiHarness.repos.mockResolvedValueOnce([{ full_name: "org/repo" }]);
    expect(await (await getHandler(repos.Route)()).json()).toEqual({
      repos: [{ full_name: "org/repo" }],
    });
    apiHarness.repos.mockRejectedValueOnce("offline");
    expect((await getHandler(repos.Route)()).status).toBe(503);
  });

  it("returns model and dataset pages and handles failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const datasets = await import("../src/routes/api/datasets");
    const models = await import("../src/routes/api/models");

    apiHarness.datasets.mockResolvedValueOnce({ items: [{ id: "data" }], truncated: true });
    const datasetBody = await (await getHandler(datasets.Route)()).json();
    expect(datasetBody).toMatchObject({ datasets: [{ id: "data" }], truncated: true });
    expect(datasetBody.fetchedAt).toEqual(expect.any(String));
    apiHarness.datasets.mockRejectedValueOnce(new Error("offline"));
    expect((await getHandler(datasets.Route)()).status).toBe(503);

    apiHarness.models.mockResolvedValueOnce({ items: [{ id: "model" }], truncated: false });
    expect(await (await getHandler(models.Route)()).json()).toMatchObject({
      models: [{ id: "model" }],
      truncated: false,
    });
    apiHarness.models.mockRejectedValueOnce(new Error("offline"));
    expect((await getHandler(models.Route)()).status).toBe(503);
  });
});

describe("parameterized and custom API routes", () => {
  it("parses resource filters, clamps pagination, and handles invalid values", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resources = await import("../src/routes/api/resources");
    const handler = getHandler(resources.Route);
    apiHarness.catalog.mockResolvedValue([]);
    apiHarness.queryCatalog.mockReturnValue({ items: [], total: 0 });

    const response = await handler({
      request: new Request(
        "https://openodia.com/api/resources?kind=model&license=MIT&author=odia&q=text&limit=999&offset=-1",
      ),
    });
    expect(response.status).toBe(200);
    expect(apiHarness.queryCatalog).toHaveBeenCalledWith([], {
      kind: "model",
      license: "MIT",
      author: "odia",
      q: "text",
      limit: 200,
      offset: 0,
    });

    await handler({ request: new Request("https://openodia.com/api/resources?limit=nope") });
    expect(apiHarness.queryCatalog).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
    apiHarness.catalog.mockRejectedValueOnce(new Error("offline"));
    expect(
      (await handler({ request: new Request("https://openodia.com/api/resources") })).status,
    ).toBe(503);
  });

  it("returns video success and failure response shapes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const videos = await import("../src/routes/api/videos");
    const handler = getHandler(videos.Route);
    apiHarness.videos.mockResolvedValueOnce([{ name: "OpenOdia" }]);
    const success = await handler();
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ channels: [{ name: "OpenOdia" }] });
    apiHarness.videos.mockRejectedValueOnce(new Error("offline"));
    const failure = await handler();
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ channels: [], error: "internal_error" });
  });

  it("normalizes PyPI success, non-OK, and thrown responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pypi = await import("../src/routes/api/pypi");
    const handler = getHandler(pypi.Route);
    apiHarness.fetchWithTimeout.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ info: { version: "1.2.3", summary: "Odia" }, releases: { a: [], b: [] } }),
        { status: 200 },
      ),
    );
    expect(await (await handler()).json()).toEqual({
      version: "1.2.3",
      summary: "Odia",
      releases: 2,
    });
    apiHarness.fetchWithTimeout.mockResolvedValueOnce(new Response("no", { status: 500 }));
    expect(await (await handler()).json()).toEqual({ version: "0.1.0", summary: "", releases: 0 });
    apiHarness.fetchWithTimeout.mockRejectedValueOnce(new Error("offline"));
    expect(await (await handler()).json()).toEqual({ version: "0.1.0", summary: "", releases: 0 });

    apiHarness.fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ info: { version: "9.9.9", summary: "No releases key" } }), {
        status: 200,
      }),
    );
    expect(await (await handler()).json()).toEqual({
      version: "9.9.9",
      summary: "No releases key",
      releases: 0,
    });
  });
});
