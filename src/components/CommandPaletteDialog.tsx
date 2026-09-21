import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Database, FileText, GraduationCap, Play, Wrench } from "lucide-react";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  normalizeSearch,
  type SearchKind,
  type SearchResponse,
  type SearchResult,
} from "../lib/search";
import { GithubIcon } from "./icons";

const PAGES = [
  { label: "Home", path: "/" },
  { label: "Tools", path: "/tools" },
  { label: "Models", path: "/models" },
  { label: "Datasets", path: "/datasets" },
  { label: "Tutorials", path: "/tutorials" },
  { label: "Playground", path: "/playground" },
  { label: "Events", path: "/events" },
  { label: "Papers", path: "/papers" },
  { label: "Treebank search", path: "/treebank" },
  { label: "Add your project", path: "/contribute" },
  { label: "API", path: "/api" },
  { label: "About", path: "/about" },
];

const MIN_REMOTE_QUERY_LENGTH = 2;
const REMOTE_SEARCH_DEBOUNCE_MS = 350;

const GROUPS: ReadonlyArray<{ kind: SearchKind; label: string }> = [
  { kind: "repository", label: "Repositories" },
  { kind: "tool", label: "Tools" },
  { kind: "model", label: "Models" },
  { kind: "dataset", label: "Datasets" },
  { kind: "paper", label: "Papers" },
  { kind: "tutorial", label: "Tutorials" },
  { kind: "event", label: "Events" },
];

function ResultIcon({ kind }: { kind: SearchKind }) {
  if (kind === "repository") return <GithubIcon />;
  if (kind === "model" || kind === "dataset") return <Database />;
  if (kind === "paper") return <GraduationCap />;
  if (kind === "tutorial") return <Play />;
  if (kind === "event") return <Calendar />;
  return <Wrench />;
}

/** The service ranks complete results; cmdk only manages dialog focus and keys. */
export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const needle = query.trim();
  const normalizedNeedle = normalizeSearch(needle);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDeferredQuery(needle), REMOTE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [needle]);
  const normalizedDeferredQuery = normalizeSearch(deferredQuery);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["palette", "search", normalizedDeferredQuery],
    queryFn: async ({ signal }: { signal?: AbortSignal } = {}) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(deferredQuery)}&limit=50`, {
        signal,
      });
      if (!response.ok) throw new Error("search");
      return (await response.json()) as SearchResponse;
    },
    enabled:
      open &&
      normalizedNeedle.length >= MIN_REMOTE_QUERY_LENGTH &&
      normalizedDeferredQuery.length >= MIN_REMOTE_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const pages = useMemo(
    () =>
      PAGES.filter(
        (page) => !normalizedNeedle || normalizeSearch(page.label).includes(normalizedNeedle),
      ),
    [normalizedNeedle],
  );
  const results = useMemo(() => data?.results ?? [], [data]);
  const resultPages = results
    .filter((result) => result.kind === "page" && result.href)
    .map((result) => ({ label: result.title, path: result.href! }));
  const visiblePages = normalizedNeedle && resultPages.length > 0 ? resultPages : pages;
  // Preserve the service's relevance order even though the visual treatment
  // groups kinds. A fixed group order would put a low-score repository above
  // an exact paper title simply because "Repositories" came first.
  const orderedGroups = useMemo(
    () =>
      results.reduce<Array<{ kind: SearchKind; label: string; results: SearchResult[] }>>(
        (groups, result) => {
          const existing = groups.find((group) => group.kind === result.kind);
          if (existing) existing.results.push(result);
          else {
            const definition = GROUPS.find((group) => group.kind === result.kind);
            if (definition) groups.push({ ...definition, results: [result] });
          }
          return groups;
        },
        [],
      ),
    [results],
  );
  const unavailable = data?.sources?.filter((source) => source.status === "unavailable") ?? [];
  const close = () => onOpenChange(false);
  const go = (result: SearchResult) => {
    close();
    if (result.href) navigate({ to: result.href });
    else if (result.externalHref && typeof window !== "undefined") {
      window.open(result.externalHref, "_blank", "noreferrer");
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search all OpenOdia resources…"
      />
      <CommandList>
        <CommandGroup heading="Pages">
          {visiblePages.map((page) => (
            <CommandItem
              key={page.path}
              value={page.label}
              onSelect={() => {
                close();
                navigate({ to: page.path });
              }}
            >
              <FileText />
              <span>{page.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {normalizedNeedle.length >= MIN_REMOTE_QUERY_LENGTH && (isLoading || isFetching) && (
          <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
            Searching OpenOdia…
          </p>
        )}
        {normalizedNeedle.length >= MIN_REMOTE_QUERY_LENGTH && isError && (
          <div className="px-3 py-3 text-sm text-muted-foreground" role="alert">
            <p>Search is temporarily unavailable.</p>
            <button
              className="mt-2 text-neon underline"
              type="button"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {data?.partial && (
          <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
            Partial results: {unavailable.map((source) => source.source).join(", ")} unavailable.
          </p>
        )}

        {orderedGroups.map((group) => {
          return (
            <CommandGroup key={group.kind} heading={group.label}>
              {group.results.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => go(result)}
                  className="group"
                >
                  <ResultIcon kind={result.kind} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{result.title}</span>
                    <span className="truncate text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground">
                      {result.summary || result.source}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {normalizedNeedle.length >= MIN_REMOTE_QUERY_LENGTH &&
          !isLoading &&
          !isFetching &&
          !isError &&
          results.length === 0 &&
          visiblePages.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
              No matches. Try a title, creator, task, or category.
            </p>
          )}
        {normalizedNeedle.length === 1 && (
          <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
            Type at least 2 characters to search all resources.
          </p>
        )}
        {!normalizedNeedle && (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            Search pages, projects, models, datasets, papers, tutorials, and events.
          </p>
        )}
      </CommandList>
    </CommandDialog>
  );
}
