import {
  Outlet,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { attachRouterServerSsrUtils } from "@tanstack/react-router/ssr/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ssrEntry, { streamHandler } from "../src/lib/ssr-entry";

// A real router with a test-only route whose component throws during render.
function serverRouter(path: string) {
  const root = createRootRoute({
    component: () => <Outlet />,
    notFoundComponent: () => <h1>404</h1>,
    errorComponent: () => <h1>Something broke</h1>,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <h1>Home</h1>,
  });
  const boom = createRoute({
    getParentRoute: () => root,
    path: "/boom",
    component: () => {
      throw new Error("render failed");
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([home, boom]),
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });
  attachRouterServerSsrUtils({ router, manifest: undefined });
  return router;
}

async function render(path: string, userAgent = "Mozilla/5.0") {
  const router = serverRouter(path);
  // The same steps createStartHandler runs before calling the stream handler.
  await router.load();
  await router.serverSsr!.dehydrate();
  const request = new Request(`http://localhost${path}`, { headers: { "User-Agent": userAgent } });
  const response = await streamHandler({ request, router, responseHeaders: new Headers() });
  return { status: response.status, html: await response.text() };
}

describe("SSR response status", () => {
  afterEach(() => vi.restoreAllMocks());

  it("answers 200 for a route that renders", async () => {
    const { status, html } = await render("/");
    expect(status).toBe(200);
    expect(html).toContain("<h1>Home</h1>");
  });

  it("answers 404 for an unknown URL, with the not-found page", async () => {
    const { status, html } = await render("/no-such-page");
    expect(status).toBe(404);
    expect(html).toContain("<h1>404</h1>");
  });

  it("answers 500 when a route throws during render, and logs the error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status } = await render("/boom");
    expect(status).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "render failed" }));
  });

  it("answers 500 to bots too, which wait for the whole document", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await render("/boom", "Googlebot/2.1")).status).toBe(500);
  });

  it("is the handler the Worker's server entry uses", () => {
    expect(typeof ssrEntry.fetch).toBe("function");
  });
});
