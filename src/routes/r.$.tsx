import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronLeft, Download, ExternalLink, Heart, Link2, Star } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { LicenseBadge, ResourceMeta } from "../components/ResourceMeta";
import { prettySize } from "../lib/dataset-size";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { KIND_LABEL, refFromSplat, type ResourceRef } from "../lib/resource-id";
import { CATALOG_SOURCES } from "../lib/sources/catalogs";
import { loadCatalog } from "../lib/sources/catalog";
import { loadDatasetPreview, type DatasetPreview } from "../lib/sources/preview";
import { loadResource, type Resource } from "../lib/sources/resource";

const SITE = "https://openodia.com";

const getResource = createServerFn({ method: "GET" })
  .inputValidator((splat: string) => splat)
  .handler(
    async ({
      data: splat,
    }): Promise<{
      resource: Resource;
      preview: DatasetPreview | null;
      listedIn: { name: string; url: string }[];
    }> => {
      const ref = refFromSplat(splat);
      if (!ref) throw notFound();

      const resource = await loadResource(ref).catch((e) => {
        console.error("resource loader:", e);
        return null;
      });
      if (!resource) throw notFound();

      // Only datasets have a viewer, and a missing preview must not take the
      // page down with it.
      const preview =
        ref.kind === "dataset"
          ? await loadDatasetPreview(ref.id).catch((e) => {
              console.error("preview:", e);
              return { available: false as const, reason: "The dataset viewer is unreachable." };
            })
          : null;

      // Which of the overlapping Odia catalogs carry this resource. The
      // cross-reference is the point of merging them — one entry, many lists.
      const listedIn = await loadCatalog()
        .then((entries) => {
          const hit = entries.find((e) => e.permalink === `/r/${ref.kind}/${ref.id}`);
          return (hit?.sources ?? []).flatMap((s) => CATALOG_SOURCES[s] ?? []);
        })
        .catch(() => []);

      return { resource, preview, listedIn };
    },
  );

export const Route = createFileRoute("/r/$")({
  loader: ({ params }) => getResource({ data: params._splat ?? "" }),
  staleTime: 60 * 60 * 1000,
  head: ({ loaderData }) => {
    const r = loaderData?.resource;
    if (!r) return {};
    const title = `${r.name} · ${KIND_LABEL[r.kind]} · OpenOdia`;
    const description =
      r.description || `${KIND_LABEL[r.kind]} by ${r.author}, listed in the OpenOdia directory.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE}/r/${r.kind}/${r.id}` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/r/${r.kind}/${r.id}` }],
    };
  },
  component: ResourcePage,
});

/** schema.org type that matches what the resource actually is. */
function resourceSchema(r: Resource) {
  const shared = {
    "@context": "https://schema.org",
    name: r.name,
    description: r.description,
    url: `${SITE}/r/${r.kind}/${r.id}`,
    sameAs: r.url,
    ...(r.license ? { license: r.license } : {}),
    ...(r.createdAt ? { dateCreated: r.createdAt } : {}),
    ...(r.updatedAt ? { dateModified: r.updatedAt } : {}),
    creator: { "@type": "Organization", name: r.author },
  };
  if (r.kind === "dataset") {
    return { ...shared, "@type": "Dataset", inLanguage: "or" };
  }
  return {
    ...shared,
    "@type": "SoftwareSourceCode",
    ...(r.topic ? { programmingLanguage: r.topic } : {}),
  };
}

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(`${SITE}${path}`).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => setCopied(false),
        );
      }}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-neon hover:text-neon"
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

function backTo(kind: ResourceRef["kind"]) {
  if (kind === "model") return { to: "/models" as const, label: "Models" };
  if (kind === "dataset") return { to: "/datasets" as const, label: "Datasets" };
  return { to: "/tools" as const, label: "Tools" };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ResourcePage() {
  // `listedIn` defaults so a loader payload without it (a stale cached result
  // during a deploy, or an HMR reload) renders instead of throwing.
  const { resource: r, preview, listedIn = [] } = Route.useLoaderData();
  const path = `/r/${r.kind}/${r.id}`;
  const back = backTo(r.kind);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <JsonLd data={resourceSchema(r)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: SITE },
          { name: back.label, url: `${SITE}${back.to}` },
          { name: r.name, url: `${SITE}${path}` },
        ])}
      />

      <Reveal>
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-neon"
        >
          <ChevronLeft size={14} /> {back.label}
        </Link>

        <p className="mt-6 text-sm uppercase tracking-widest text-neon">{KIND_LABEL[r.kind]}</p>
        <h1 className="mt-2 break-words font-display text-4xl font-bold md:text-6xl">{r.name}</h1>
        <p className="mt-2 text-muted-foreground">by {r.author}</p>

        {r.description && <p className="mt-6 text-lg text-muted-foreground">{r.description}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <LicenseBadge spdx={r.license} />
          {r.topic && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider">
              {r.topic}
            </span>
          )}
          {r.stars !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Star size={13} className="text-saffron" /> {r.stars}
            </span>
          )}
          {r.downloads !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Download size={13} /> {r.downloads}
            </span>
          )}
          {r.likes !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Heart size={13} /> {r.likes}
            </span>
          )}
          {r.sizeCategory && <span>{prettySize(r.sizeCategory)} rows</span>}
        </div>

        {/* Freshness: the known trust-killer of curated lists is a dead or
            long-abandoned entry presented as current. */}
        {(r.updatedAt || r.createdAt) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {r.updatedAt && <>Last updated {formatDate(r.updatedAt)}</>}
            {r.updatedAt && r.createdAt && " · "}
            {r.createdAt && <>published {formatDate(r.createdAt)}</>}
          </p>
        )}

        {listedIn.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Listed in
            {listedIn.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border px-2 py-0.5 transition hover:border-neon hover:text-neon"
              >
                {c.name}
              </a>
            ))}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Open on {r.kind === "gh" ? "GitHub" : "Hugging Face"} <ExternalLink size={14} />
          </a>
          <CopyLink path={path} />
        </div>
      </Reveal>

      {preview && (
        <Reveal delay={0.05} className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Preview</h2>
          {preview.available ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                First {preview.rows.length} rows of <code>{preview.config}</code> /{" "}
                <code>{preview.split}</code>, from the Hugging Face dataset viewer.
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-surface-2">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c} className="px-3 py-2 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border align-top">
                        {row.map((cell, j) => (
                          <td key={j} className="max-w-xs px-3 py-2 text-muted-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-2 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              {preview.reason}
            </p>
          )}
        </Reveal>
      )}

      <Reveal delay={0.1} className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Cite this</h2>
        <div className="mt-3 rounded-2xl border border-border bg-surface">
          <ResourceMeta
            license={r.license}
            entry={{ name: r.name, author: r.author, url: r.url, createdAt: r.createdAt }}
            extra={r.modalities?.map((m) => (
              <span
                key={m}
                className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {m}
              </span>
            ))}
          />
        </div>
      </Reveal>

      {r.tags.length > 0 && (
        <Reveal delay={0.15} className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Tags</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.tags.slice(0, 40).map((t) => (
              <span
                key={t}
                className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
