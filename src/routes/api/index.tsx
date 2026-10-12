import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Reveal } from "../../components/Reveal";
import { pageHead } from "../../lib/seo";

export const Route = createFileRoute("/api/")({
  head: () =>
    pageHead({
      path: "api",
      title: "API · OpenOdia",
      description:
        "Public API reference for OpenOdia — query repos, tools, events, contributors, and more.",
      ogDescription: "OpenOdia public APIs for building on Odia open-source data.",
    }),
  component: ApiDocsPage,
});

const SCALAR_BUNDLE = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
const SCALAR_BUNDLE_ID = "scalar-bundle";
const OPENAPI_URL = "/.well-known/openapi.json";

function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Guard kept for safety even though React commits refs before running
    // effects, so this is unreachable-null on a ref attached in this render.
    /* v8 ignore start */
    if (!containerRef.current) return;
    /* v8 ignore stop */

    const container = containerRef.current;
    document.body.setAttribute("data-openodia-api-docs", "");
    let instance:
      | {
          destroy: () => void;
          updateConfiguration: (configuration: Record<string, unknown>) => void;
        }
      | undefined;
    const themeConfiguration = () => {
      const darkMode = !document.documentElement.classList.contains("light");
      return { darkMode, forceDarkModeState: darkMode ? "dark" : "light" };
    };
    let configuration: Record<string, unknown>;
    const mount = () => {
      if (instance) return;
      instance = (
        window as Window & {
          Scalar?: {
            createApiReference: (
              element: HTMLElement,
              configuration: Record<string, unknown>,
            ) => NonNullable<typeof instance>;
          };
        }
      ).Scalar?.createApiReference(
        container,
        (configuration = {
          url: OPENAPI_URL,
          customFetch: (input: string | URL | Request, init?: RequestInit) => {
            const url = new URL(
              input instanceof Request ? input.url : String(input),
              window.location.origin,
            );
            return window.fetch(
              input,
              url.pathname === OPENAPI_URL ? { ...init, cache: "no-cache" } : init,
            );
          },
          theme: "default",
          ...themeConfiguration(),
          hideDarkModeToggle: true,
          hideClientButton: false,
          layout: "modern",
          servers: [{ url: window.location.origin }],
          // MCP requires both media types even though this server returns JSON.
          onBeforeRequest: ({
            request,
            requestBuilder,
          }: {
            request: Request;
            requestBuilder: { headers: Headers };
          }) => {
            if (new URL(request.url).pathname === "/mcp") {
              requestBuilder.headers.set("Accept", "application/json, text/event-stream");
            }
          },
        }),
      );
    };
    let bundle = document.getElementById(SCALAR_BUNDLE_ID) as HTMLScriptElement | null;
    if (!bundle) {
      bundle = document.createElement("script");
      bundle.id = SCALAR_BUNDLE_ID;
      bundle.src = SCALAR_BUNDLE;
      bundle.async = true;
      document.body.appendChild(bundle);
    }
    bundle.addEventListener("load", mount);
    if ("Scalar" in window) mount();
    const themeObserver = new MutationObserver(() => {
      const theme = themeConfiguration();
      instance?.updateConfiguration({ ...configuration, ...theme });
      // Scalar's body theme classes are initialized at mount; configuration
      // updates alone leave them behind when the host site's theme changes.
      document.body.classList.toggle("dark-mode", theme.darkMode);
      document.body.classList.toggle("light-mode", !theme.darkMode);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      themeObserver.disconnect();
      document.body.removeAttribute("data-openodia-api-docs");
      bundle.removeEventListener("load", mount);
      instance?.destroy();
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Developers</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          OpenOdia <span className="text-gradient">API</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Public, unauthenticated endpoints for building on Odia open-source data — repos, tools,
          events, contributors, tutorials, and more. The OpenAPI spec is at{" "}
          <a
            href={OPENAPI_URL}
            className="text-neon hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            /.well-known/openapi.json
          </a>
          .
        </p>
      </Reveal>

      <section id="mcp" className="mt-12 rounded-3xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-bold">Search with an AI agent</h2>
        <p className="mt-3 text-muted-foreground">
          Connect a remote MCP client to <code>https://openodia.com/mcp</code> using Streamable
          HTTP. No API key is required. The read-only <code>search</code> tool searches resource
          metadata and page summaries across datasets, models, tutorials, tools, repositories,
          papers, and events. It does not search dataset rows or tutorial transcripts.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-background p-4 text-sm">
          <code>{`{
  "mcpServers": {
    "openodia": { "url": "https://openodia.com/mcp" }
  }
}`}</code>
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Client configuration varies. Tool arguments: <code>query</code> (2–80 searchable
          characters), optional <code>kinds</code> (page, repository, tool, model, dataset, paper,
          tutorial, event), and <code>limit</code> (1–50, default 20). Include both tool and
          repository for broad tool discovery. Results include absolute links, a snapshot timestamp,
          and
          <code> partial</code> / <code>sources</code> metadata; check those before assuming
          coverage is complete.
        </p>
        <p className="mt-3 text-sm">
          <a href="/.well-known/api-catalog" className="text-neon hover:underline">
            API catalog
          </a>
          {" · "}
          <a href="/api/health" className="text-neon hover:underline">
            Service liveness
          </a>
        </p>
      </section>
      {/* A transformed ancestor traps Scalar's fixed request modal inside the
          entire docs page. Avoid bg-surface's global light-mode hover lift. */}
      <div
        ref={containerRef}
        data-api-reference
        id="openodia-api-reference"
        className="mt-12 rounded-3xl border border-border bg-[var(--surface)]"
      />
    </div>
  );
}
