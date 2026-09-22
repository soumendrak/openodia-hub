import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { ORGANIZERS, type Organizer } from "../data/organizers";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { JsonLd, breadcrumbSchema } from "../lib/jsonld";
import { normalizeSearch } from "../lib/search";
import { pageHead } from "../lib/seo";

export const Route = createFileRoute("/communities")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q.length <= 80 ? { q: search.q } : {},
  head: () =>
    pageHead({
      path: "communities",
      title: "Communities · OpenOdia",
      description:
        "Official destinations for Odisha AI communities, campus chapters, institutions, and public organizers.",
      ogDescription: "Find the organizations behind OpenOdia's curated event collection.",
    }),
  component: CommunitiesPage,
});

const KIND_LABEL: Record<Organizer["kind"], string> = {
  community: "Community",
  "campus-chapter": "Campus chapter",
  institution: "Institution",
  government: "Government",
};
const MODE_LABEL: Record<Organizer["collectionMode"], string> = {
  automated: "Automated collection",
  partial: "Partial collection",
  manual: "Curated events listed",
  "archive-only": "Archive only",
};

function CommunitiesPage() {
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(routeSearch.q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef);
  useEffect(() => setDraft(routeSearch.q ?? ""), [routeSearch.q]);
  const setQuery = (value: string) => {
    const q = value.slice(0, 80);
    setDraft(q);
    void navigate({ search: q ? { q } : {}, replace: true });
  };
  const needle = normalizeSearch(draft);
  const organizers = ORGANIZERS.filter(
    (organizer) =>
      !needle ||
      [
        organizer.name,
        ...organizer.aliases,
        organizer.region,
        organizer.kind,
        organizer.description,
      ].some((value) => normalizeSearch(value).includes(needle)),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <JsonLd
        data={breadcrumbSchema([
          { name: "OpenOdia", url: "https://openodia.com" },
          { name: "Communities", url: "https://openodia.com/communities" },
        ])}
      />
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Directory</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Communities &amp; <span className="text-gradient">organizers</span>.
        </h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Independent organizations behind the curated event collection. OpenOdia lists their
          official destinations; it does not operate them or make organizer-wide attendance claims.
        </p>
      </Reveal>
      <Reveal>
        <div className="relative mt-10 max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="search"
            value={draft}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organizations, regions, or types… [/]"
            className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
          />
          {draft && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear community search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </Reveal>
      <p className="mt-6 text-sm text-muted-foreground">
        {organizers.length} organization{organizers.length === 1 ? "" : "s"} shown · event counts
        are scoped to curated events listed.
      </p>
      {organizers.length === 0 ? (
        <p
          className="mt-8 rounded-2xl border border-border bg-surface p-6 text-muted-foreground"
          role="status"
        >
          No organizers match that search. Try a canonical name, region, or organization type.
        </p>
      ) : (
        <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
          {organizers.map((organizer) => (
            <OrganizerCard key={organizer.id} organizer={organizer} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrganizerCard({ organizer }: { organizer: Organizer }) {
  return (
    <article
      id={organizer.id}
      className="scroll-mt-28 min-w-0 rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-neon">
            {KIND_LABEL[organizer.kind]} · {organizer.region}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">{organizer.name}</h2>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {MODE_LABEL[organizer.collectionMode]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{organizer.description}</p>
      <p className="mt-3 text-xs text-muted-foreground">{organizer.verificationNote}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={organizer.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-neon hover:underline"
        >
          Official destination <ExternalLink size={13} />
        </a>
        <Link
          to="/events"
          search={{ community: organizer.id }}
          className="text-sm text-foreground hover:text-neon hover:underline"
        >
          View curated events
        </Link>
      </div>
    </article>
  );
}
