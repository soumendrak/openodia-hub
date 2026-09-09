import { afterEach, describe, expect, it, vi } from "vitest";

const entryHarness = vi.hoisted(() => ({
  createRouter: vi.fn((options: unknown) => ({ options })),
  middleware: undefined as
    | ((input: { next: () => Promise<unknown> }) => Promise<unknown>)
    | undefined,
}));

vi.mock("@tanstack/react-router", () => ({ createRouter: entryHarness.createRouter }));
vi.mock("../src/routeTree.gen", () => ({ routeTree: { id: "tree" } }));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    server: (middleware: typeof entryHarness.middleware) => {
      entryHarness.middleware = middleware;
      return middleware;
    },
  }),
  createStart: (factory: () => unknown) => factory(),
}));
vi.mock("../src/lib/error-page", () => ({ renderErrorPage: () => "<h1>failed</h1>" }));

describe("application entry points", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a router with query context and intentional preload defaults", async () => {
    const { getRouter } = await import("../src/router");
    const router = getRouter() as { options: Record<string, unknown> };
    expect(router.options).toMatchObject({
      routeTree: { id: "tree" },
      scrollRestoration: true,
      defaultPreload: "intent",
      defaultPreloadStaleTime: 120000,
    });
    expect(router.options.context).toMatchObject({ queryClient: expect.anything() });
  });

  it("passes successful and HTTP-shaped failures through the start middleware", async () => {
    const { startInstance } = await import("../src/start");
    expect(startInstance).toMatchObject({ requestMiddleware: [expect.any(Function)] });
    const middleware = entryHarness.middleware!;
    const response = new Response("ok");
    await expect(middleware({ next: async () => response })).resolves.toBe(response);

    const redirect = { statusCode: 302 };
    await expect(middleware({ next: async () => Promise.reject(redirect) })).rejects.toBe(redirect);
  });

  it("converts unexpected middleware failures into a safe HTML response", async () => {
    await import("../src/start");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = (await entryHarness.middleware!({
      next: async () => Promise.reject(new Error("secret failure")),
    })) as Response;
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toBe("<h1>failed</h1>");
    expect(error).toHaveBeenCalled();
  });
});
