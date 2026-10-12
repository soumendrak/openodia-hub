import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleMcpRequest } from "../src/lib/mcp";
import type { SearchSnapshot } from "../src/lib/sources/search";

const snapshot: SearchSnapshot = {
  documents: [
    {
      id: "model:1",
      kind: "model",
      title: "Odia speech model",
      summary: "Speech recognition",
      href: "/r/model/test/asr",
      source: "catalog",
    },
    {
      id: "dataset:1",
      kind: "dataset",
      title: "Odia speech dataset",
      summary: "Speech recordings",
      externalHref: "https://huggingface.co/datasets/test/speech",
      source: "catalog",
    },
    {
      id: "tutorial:1",
      kind: "tutorial",
      title: "Odia speech tutorial",
      summary: "Learn speech recognition",
      href: "/tutorials?q=speech",
      source: "videos",
    },
    {
      id: "tool:1",
      kind: "tool",
      title: "Odia speech tool",
      summary: "Speech library",
      href: "/tools",
      source: "catalog",
    },
    {
      id: "page:1",
      kind: "page",
      title: "Odia speech guide",
      summary: "Site guide",
      href: "/",
      source: "pages",
    },
  ],
  sources: [
    { source: "catalog", status: "ready", count: 3 },
    { source: "videos", status: "unavailable", count: 1 },
  ],
  builtAt: "2026-10-12T00:00:00Z",
};

async function connect(loader = vi.fn().mockResolvedValue(snapshot)) {
  const transport = new StreamableHTTPClientTransport(new URL("https://openodia.com/mcp"), {
    fetch: async (input, init) => handleMcpRequest(new Request(input, init), loader),
  });
  const client = new Client({ name: "integration-test", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport, loader };
}

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://openodia.com/mcp", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
  });
}

describe("MCP Streamable HTTP integration", () => {
  it("negotiates, discovers a read-only tool, and searches every requested category", async () => {
    const { client, transport, loader } = await connect();
    try {
      expect(transport.sessionId).toBeUndefined();
      expect(loader).not.toHaveBeenCalled();
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["search"]);
      expect(tools[0].annotations?.readOnlyHint).toBe(true);
      for (const kind of ["model", "dataset", "tutorial", "tool", "page"]) {
        const result = await client.callTool({
          name: "search",
          arguments: { query: "ଓଡ଼ିଆ speech", kinds: [kind], limit: 1 },
        });
        expect(result.isError).not.toBe(true);
        const data = result.structuredContent as {
          results: { kind: string; href: string }[];
          partial: boolean;
          builtAt: string;
        };
        expect(data.results).toHaveLength(1);
        expect(data.results[0].kind).toBe(kind);
        expect(data.results[0].href).toMatch(/^https:\/\//);
        expect(data.partial).toBe(true);
        expect(data.builtAt).toBe(snapshot.builtAt);
      }
      const limited = await client.callTool({
        name: "search",
        arguments: { query: "Odia", limit: 2 },
      });
      expect((limited.structuredContent as { results: unknown[] }).results).toHaveLength(2);
      const empty = await client.callTool({ name: "search", arguments: { query: "nonexistent" } });
      expect((empty.structuredContent as { results: unknown[] }).results).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it("rejects invalid tool input before loading data", async () => {
    const { client, loader } = await connect();
    try {
      for (const args of [
        { query: "x" },
        { query: "!!" },
        { query: "x".repeat(81) },
        { query: "Odia", kinds: ["invalid"] },
        { query: "Odia", limit: 51 },
        { query: "Odia", limit: 1.5 },
      ]) {
        expect((await client.callTool({ name: "search", arguments: args })).isError).toBe(true);
      }
      expect(loader).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it("returns a tool error on snapshot failure and isolates concurrent clients", async () => {
    const a = await connect();
    const b = await connect(vi.fn().mockRejectedValue(new Error("private upstream error")));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const [ok, failed] = await Promise.all([
        a.client.callTool({ name: "search", arguments: { query: "Odia" } }),
        b.client.callTool({ name: "search", arguments: { query: "Odia" } }),
      ]);
      expect(ok.isError).not.toBe(true);
      expect(failed.isError).toBe(true);
      expect(JSON.stringify(failed)).not.toContain("private upstream error");
    } finally {
      log.mockRestore();
      await Promise.all([a.client.close(), b.client.close()]);
    }
  });

  it("enforces transport methods, origin, content negotiation, JSON, and body size", async () => {
    expect((await handleMcpRequest(new Request("https://openodia.com/mcp"))).status).toBe(405);
    expect(
      (await handleMcpRequest(new Request("https://openodia.com/mcp", { method: "OPTIONS" })))
        .status,
    ).toBe(204);
    expect((await handleMcpRequest(request("{}", { Origin: "https://evil.example" }))).status).toBe(
      403,
    );
    const sameOrigin = await handleMcpRequest(
      new Request("https://openodia.com/mcp", {
        method: "OPTIONS",
        headers: { Origin: "https://openodia.com" },
      }),
    );
    expect(sameOrigin.status).toBe(204);
    expect(sameOrigin.headers.get("access-control-allow-headers")).toContain(
      "MCP-Protocol-Version",
    );
    expect((await handleMcpRequest(request("{}", { Accept: "text/html" }))).status).toBe(406);
    expect((await handleMcpRequest(request("{}", { "Content-Type": "text/plain" }))).status).toBe(
      415,
    );
    expect((await handleMcpRequest(request("{"))).status).toBe(400);
    expect((await handleMcpRequest(request(" ".repeat(17 * 1024)))).status).toBe(413);
    const ping = await handleMcpRequest(
      request(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })),
    );
    expect(ping.status).toBe(200);
    expect(ping.headers.get("cache-control")).toBe("no-store");
  });
});
