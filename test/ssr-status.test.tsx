import {
  Outlet,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
} from "@tanstack/react-router";
import { attachRouterServerSsrUtils } from "@tanstack/react-router/ssr/server";
import { Suspense, lazy } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamHandler } from "../src/lib/ssr-entry";

function Boom(): never {
  throw new Error("render failed");
}

function Missing(): never {
  throw notFound();
}

// A real router with test-only routes whose components throw during render.
function serverRouter(path: string) {
  // Fails 50 ms into the render, after the shell (and its headers) can be sent.
  // Built per router: a rejected lazy() would throw synchronously on reuse.
  const LateBoom = lazy<() => never>(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error("late failure")), 50)),
  );
  const root = createRootRoute({
    component: () => (
      <html>
        <body>
          <Outlet />
        </body>
      </html>
    ),
    notFoundComponent: () => <h1>404</h1>,
    errorComponent: () => <h1>Something broke</h1>,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <h1>Home</h1>,
  });
  const boom = createRoute({ getParentRoute: () => root, path: "/boom", component: Boom });
  const missing = createRoute({ getParentRoute: () => root, path: "/missing", component: Missing });
  const late = createRoute({
    getParentRoute: () => root,
    path: "/late",
    component: () => (
      <Suspense fallback={<p>Loading</p>}>
        <LateBoom />
      </Suspense>
    ),
  });
  // The render error is reported first, then notFound(): it must not downgrade 500 to 404.
  const both = createRoute({
    getParentRoute: () => root,
    path: "/both",
    component: () => (
      <>
        <Suspense fallback={null}>
          <Boom />
        </Suspense>
        <Suspense fallback={null}>
          <Missing />
        </Suspense>
      </>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([home, boom, missing, late, both]),
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  });
  attachRouterServerSsrUtils({ router, manifest: undefined });
  return router;
}

async function render(path: string, userAgent = "Mozilla/5.0", signal?: AbortSignal) {
  const router = serverRouter(path);
  // The same steps createStartHandler runs before calling the stream handler.
  await router.load();
  await router.serverSsr!.dehydrate();
  const request = new Request(`http://localhost${path}`, {
    headers: { "User-Agent": userAgent },
    signal,
  });
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

  it("answers 404 when a route component throws notFound(), without logging an error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await render("/missing")).status).toBe(404);
    expect(log).not.toHaveBeenCalled();
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

  it("answers 500 to a bot when a Suspense boundary fails after the shell", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await render("/late", "Googlebot/2.1")).status).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "late failure" }));
  });

  it("streams a browser the full document with 200 when the failure comes after the shell", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, html } = await render("/late", "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36");
    expect(status).toBe(200);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
    // The failure did happen, after the headers had gone out.
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "late failure" }));
  });

  it("doesn't log or answer 500 when the client disconnects mid-render", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 10); // Before /late fails at 50 ms.
    const { status } = await render("/late", "Googlebot/2.1", abort.signal);
    expect(status).toBe(200);
    expect(log).not.toHaveBeenCalled();
  });

  it("answers 500 when a page throws a render error and then notFound()", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await render("/both")).status).toBe(500);
  });
});
