import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shallow-merges `next` over `prev`, skipping keys whose incoming value is
 * empty (undefined / null / "").
 *
 * D1 and Bevy rows always carry `location` and `description` as *present*
 * keys, so a plain spread would blank out hand-enriched venue lines and
 * descriptions on the curated event that shares the URL.
 */
export function mergeNonEmpty<T extends object>(prev: T, next: Partial<T>): T {
  const merged = { ...prev };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === null || value === "") continue;
    Object.assign(merged, { [key]: value });
  }
  return merged;
}
