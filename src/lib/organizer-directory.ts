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
 * normalisation the filter matches with. The router parses `?q=2024`,
 * `?q=true`, and `?q=null` as JSON primitives, so those are read back as text.
 */
export function boundDirectoryQuery(value: unknown): string | undefined {
  if (value !== null && !["string", "number", "boolean"].includes(typeof value)) return undefined;
  const q = String(value).trim().slice(0, MAX_DIRECTORY_QUERY);
  return normalizeSearch(q) !== "" ? q : undefined;
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
