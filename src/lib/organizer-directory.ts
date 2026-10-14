import {
  ORGANIZER_KINDS,
  ORGANIZERS,
  type CollectionMode,
  type OrganizerKind,
  type PublishedOrganizer,
} from "../data/organizers";
import { normalizeSearch } from "./search";

/** Search state for `/communities`, kept in the URL so a filtered view can be shared. */
export type DirectorySearch = { q?: string; kind?: OrganizerKind };

export const MAX_DIRECTORY_QUERY = 80;

export const KIND_LABELS: Record<OrganizerKind, string> = {
  community: "Community groups",
  "student-community": "Campus chapters",
  institution: "Institutions",
  government: "Government",
  "startup-ecosystem": "Startup ecosystem",
  conference: "Conferences",
};

export const COLLECTION_LABELS: Record<CollectionMode, string> = {
  automated: "Events are collected automatically from the official page.",
  partial: "Some events are collected automatically; others are added by hand.",
  manual: "Events are added by hand after review.",
  "archive-only": "Historical events only; this organizer is no longer collected.",
};

function isKind(value: unknown): value is OrganizerKind {
  return (ORGANIZER_KINDS as readonly unknown[]).includes(value);
}

/**
 * Trims, then caps at MAX_DIRECTORY_QUERY. A query with nothing searchable
 * (blank, or only punctuation such as "!!!") is dropped, using the same
 * normalisation the filter matches with. The router JSON-parses values such
 * as `?q=2024`, `?q=null` or `?q=[2026]`, so anything that is not a string is
 * read back as its JSON text. A value nested too deeply to stringify (RangeError)
 * is dropped.
 */
export function boundDirectoryQuery(value: unknown): string | undefined {
  const text = typeof value === "string" ? value : jsonText(value);
  if (text === undefined) return undefined;
  const q = text.trim().slice(0, MAX_DIRECTORY_QUERY);
  return normalizeSearch(q) !== "" ? q : undefined;
}

function jsonText(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * Drops unknown values so a bad link falls back to the full directory. Keys
 * stay present as `undefined` so the router does not fall back to the raw,
 * unvalidated value.
 */
export function validateDirectorySearch(search: Record<string, unknown>): DirectorySearch {
  return { q: boundDirectoryQuery(search.q), kind: isKind(search.kind) ? search.kind : undefined };
}

export function filterOrganizers(
  search: DirectorySearch,
  organizers: readonly PublishedOrganizer[] = ORGANIZERS,
): PublishedOrganizer[] {
  const needle = normalizeSearch(search.q ?? "");
  return organizers.filter((organizer) => {
    if (search.kind && organizer.kind !== search.kind) return false;
    if (!needle) return true;
    return [
      organizer.canonicalName,
      ...organizer.aliases,
      organizer.region,
      organizer.description,
      KIND_LABELS[organizer.kind],
    ].some((field) => normalizeSearch(field).includes(needle));
  });
}
