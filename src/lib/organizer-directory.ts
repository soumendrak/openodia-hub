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
 * Drops empty, oversized, and unknown values so a bad link falls back to the
 * full directory. Keys stay present as `undefined` so the router does not fall
 * back to the raw, unvalidated value.
 */
export function validateDirectorySearch(search: Record<string, unknown>): DirectorySearch {
  const q =
    typeof search.q === "string" && search.q.trim() && search.q.length <= MAX_DIRECTORY_QUERY
      ? search.q
      : undefined;
  return { q, kind: isKind(search.kind) ? search.kind : undefined };
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
