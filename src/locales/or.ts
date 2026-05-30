import type { en } from "./en";

/**
 * Odia (ଓଡ଼ିଆ) translations.
 *
 * Each entry is either the translated string or null/missing — in which case
 * the runtime falls back to the English string from `en.ts`.
 *
 * TODO: bring in a native Odia speaker to fill in the missing keys. The
 * placeholders below are intentional — only one entry is filled in (the Odia
 * label for the language toggle itself, since that needs to be Odia by
 * definition).
 */
export const or: Partial<Record<keyof typeof en, string>> = {
  // Filled — required as the toggle's own label.
  // (No keys yet for translated strings; add entries here as they're verified.)
};
