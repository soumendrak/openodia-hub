/**
 * English UI strings.
 *
 * This file is the canonical key inventory. Keep keys in alphabetical order
 * within each namespace, and never use English copy as a "key" — always pick
 * a stable, structural identifier like `nav.home`.
 *
 * To extend coverage to more pages, add keys here, then add the Odia
 * translation in `or.ts`. Missing Odia keys fall back to English at runtime.
 */
export const en = {
  // Nav
  "nav.home": "Home",
  "nav.tools": "Tools",
  "nav.models": "Models",
  "nav.datasets": "Datasets",
  "nav.playground": "Playground",
  "nav.tutorials": "Tutorials",
  "nav.events": "Events",
  "nav.leaderboard": "Benchmarks",
  "nav.about": "About",
  "nav.contribute": "Add project",
  "nav.search.aria": "Open search (Cmd+K)",
  "nav.theme.aria": "Toggle theme",
  "nav.locale.aria": "Switch language",
  "nav.menu.aria": "Toggle menu",
} as const;
