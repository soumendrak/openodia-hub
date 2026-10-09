import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { Chip } from "../components/Facets";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { pageHead } from "../lib/seo";
import { ORGANIZER_KINDS, type PublishedOrganizer } from "../data/organizers";
import {
  COLLECTION_LABELS,
  KIND_LABELS,
  MAX_DIRECTORY_QUERY,
  filterOrganizers,
  validateDirectorySearch,
  type DirectorySearch,
} from "../lib/organizer-directory";

export const Route = createFileRoute("/communities")({
  validateSearch: validateDirectorySearch,
  head: () =>
    pageHead({
      path: "communities",
      title: "Communities & organizers · OpenOdia",
      description:
        "Directory of independent Odia AI communities, campus chapters, institutions, and government organizers, with their official links.",
      ogDescription: "Independent communities and organizers behind Odia AI events.",
    }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draftQuery, setDraftQuery] = useState(search.q ?? "");
  useEffect(() => setDraftQuery(search.q ?? ""), [search.q]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const update = (patch: DirectorySearch) =>
    navigate({ search: (prev) => validateDirectorySearch({ ...prev, ...patch }), replace: true });
  const setQuery = (next: string) => {
    const bounded = next.slice(0, MAX_DIRECTORY_QUERY);
    setDraftQuery(bounded);
    void update({ q: bounded });
  };
  const reset = () => {
    setDraftQuery("");
    void navigate({ search: {}, replace: true });
  };

  const organizers = filterOrganizers({ q: draftQuery, kind: search.kind });
  const filtered = Boolean(draftQuery || search.kind);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Communities", url: "https://openodia.com/communities" },
        ])}
      />

      <p className="text-sm uppercase tracking-widest text-neon">Directory</p>
      <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
        Communities & <span className="text-gradient">organizers</span>.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The groups, campus chapters, institutions, and government bodies whose events appear on
        OpenOdia. Each one is independent: being listed here does not mean it is part of or endorsed
        by OpenOdia. Who may attend and whether registration is open depend on each event, so check
        the organizer&rsquo;s official page.
      </p>

      <div className="mt-10 flex flex-col gap-4">
        <div className="relative max-w-xl">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            type="search"
            aria-label="Search communities and organizers"
            placeholder="Search names, regions, kinds… [/]"
            maxLength={MAX_DIRECTORY_QUERY}
            value={draftQuery}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
          />
          {draftQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div role="group" aria-label="Organizer kind" className="flex flex-wrap gap-2">
          <Chip active={!search.kind} onClick={() => void update({ kind: undefined })}>
            All kinds
          </Chip>
          {ORGANIZER_KINDS.map((kind) => (
            <Chip
              key={kind}
              active={search.kind === kind}
              onClick={() => void update({ kind: search.kind === kind ? undefined : kind })}
            >
              {KIND_LABELS[kind]}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {organizers.length} organizer{organizers.length === 1 ? "" : "s"}
        {filtered ? " match" : " listed"}
      </p>

      {organizers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-muted-foreground">No organizers match these filters.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-full border border-neon/40 bg-neon/5 px-5 py-2.5 text-sm font-medium text-neon transition hover:border-neon hover:bg-neon/15"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizers.map((organizer) => (
            <OrganizerCard key={organizer.id} organizer={organizer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrganizerCard({ organizer }: { organizer: PublishedOrganizer }) {
  return (
    <li
      id={organizer.id}
      className="scroll-mt-28 rounded-2xl border border-border bg-surface p-5 target:border-neon"
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {KIND_LABELS[organizer.kind]} · {organizer.region}
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold">{organizer.canonicalName}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{organizer.description}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {organizer.officialLinks.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-neon hover:text-neon"
            >
              {link.label} <ExternalLink size={11} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">How events are collected</summary>
        <p className="mt-2">{COLLECTION_LABELS[organizer.collectionMode]}</p>
        {organizer.aliases.length > 0 && (
          <p className="mt-1">Also known as: {organizer.aliases.join(", ")}</p>
        )}
      </details>
    </li>
  );
}
