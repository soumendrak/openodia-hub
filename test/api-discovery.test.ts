import { describe, expect, it, vi } from "vitest";
import { API_CATALOG, handleApiDiscovery } from "../src/lib/api-discovery";
import { OPENAPI_SPEC } from "../src/lib/openapi";

vi.mock("../src/lib/ssr-entry", () => ({
  default: {
    fetch: vi.fn(() => {
      throw new Error("SSR must not run");
    }),
  },
}));
import server from "../src/server";

describe("RFC 9727 API discovery", () => {
  it("serves linkset JSON at the Worker boundary for agent Accept headers without SSR or upstream calls", async () => {
    const response = await server.fetch(
      new Request("https://openodia.com/.well-known/api-catalog", {
        headers: { Accept: "application/linkset+json" },
      }),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/linkset+json");
    expect(response.headers.get("link")).toContain('rel="profile"');
    expect(await response.json()).toEqual(API_CATALOG);
    const [catalog, ...apis] = API_CATALOG.linkset;
    expect(catalog).toHaveProperty("item");
    expect(apis.map((api) => api.anchor)).toContain("https://openodia.com/mcp");
    expect(apis.map((api) => api.anchor)).toContain("https://openodia.com/api/search");
    expect(new Set(apis.map((api) => api.anchor)).size).toBe(apis.length);
    for (const entry of apis) {
      expect(new URL(entry.anchor).protocol).toBe("https:");
      for (const relation of ["service-desc", "service-doc", "status"]) {
        const links = (entry as Record<string, unknown>)[relation] as { href: string }[];
        expect(links).toHaveLength(1);
        expect(new URL(links[0].href).protocol).toBe("https:");
      }
      expect(OPENAPI_SPEC.paths).toHaveProperty(new URL(entry.anchor).pathname);
    }
  });

  it("provides liveness, HEAD, OPTIONS, and 405 responses without loading catalogs", async () => {
    const response = await server.fetch(
      new Request("https://openodia.com/api/health"),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      scope: "liveness",
      upstreamsChecked: false,
    });
    for (const path of ["/api/health", "/.well-known/api-catalog"]) {
      const url = `https://openodia.com${path}`;
      expect(await handleApiDiscovery(new Request(url, { method: "HEAD" }))?.text()).toBe("");
      expect(handleApiDiscovery(new Request(url, { method: "OPTIONS" }))?.status).toBe(204);
      expect(handleApiDiscovery(new Request(url, { method: "POST" }))?.status).toBe(405);
    }
    expect(handleApiDiscovery(new Request("https://openodia.com/"))).toBeUndefined();
  });

  it("exposes specs for every API in the catalog", async () => {
    const response = await server.fetch(
      new Request("https://openodia.com/.well-known/openapi.json"),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.paths["/mcp"].post.requestBody.content["application/json"]).toBeDefined();
    expect(
      spec.paths["/api/search"].get.parameters.find((param: { name: string }) => param.name === "q")
        .required,
    ).toBe(true);
  });

  it("routes MCP at the Worker boundary without invoking SSR", async () => {
    const response = await server.fetch(
      new Request("https://openodia.com/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
      undefined,
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });
});
