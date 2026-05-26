import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Reveal } from "../../components/Reveal";

export const Route = createFileRoute("/api/")({
  head: () => ({
    meta: [
      { title: "API · OpenOdia" },
      {
        name: "description",
        content:
          "Public API reference for OpenOdia — query repos, tools, events, contributors, and more.",
      },
      { property: "og:title", content: "API · OpenOdia" },
      {
        property: "og:description",
        content: "OpenOdia public APIs for building on Odia open-source data.",
      },
    ],
  }),
  component: ApiDocsPage,
});

const SCALAR_BUNDLE = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
const SCALAR_BUNDLE_ID = "scalar-bundle";
const SCALAR_CONFIG_ID = "api-reference";
const OPENAPI_URL = "/.well-known/openapi.json";

function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const configScript = document.createElement("script");
    configScript.id = SCALAR_CONFIG_ID;
    configScript.setAttribute("data-url", OPENAPI_URL);
    configScript.setAttribute(
      "data-configuration",
      JSON.stringify({
        theme: "default",
        darkMode: true,
        hideClientButton: false,
        layout: "modern",
      }),
    );
    containerRef.current.appendChild(configScript);

    // Load Scalar bundle once per page session. Browser caching handles repeats.
    if (!document.getElementById(SCALAR_BUNDLE_ID)) {
      const bundleScript = document.createElement("script");
      bundleScript.id = SCALAR_BUNDLE_ID;
      bundleScript.src = SCALAR_BUNDLE;
      bundleScript.async = true;
      document.body.appendChild(bundleScript);
    }

    return () => {
      configScript.remove();
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

      <div ref={containerRef} className="mt-12 rounded-3xl border border-border bg-surface" />
    </div>
  );
}
