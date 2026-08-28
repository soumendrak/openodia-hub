import type { en } from "./en";

/**
 * Odia (ଓଡ଼ିଆ) translations.
 *
 * Each entry is either the translated string or missing — in which case the
 * runtime falls back to the English string from `en.ts`.
 *
 * Coverage is the nav chrome only; page bodies are still English. Add keys to
 * `en.ts` and translate them here as more of the UI gets routed through i18n.
 *
 * TODO: have a native Odia speaker review these strings.
 */
export const or: Partial<Record<keyof typeof en, string>> = {
  "nav.home": "ମୂଳପୃଷ୍ଠା",
  "nav.tools": "ଉପକରଣ",
  "nav.models": "ମଡେଲ୍",
  "nav.datasets": "ଡାଟାସେଟ୍",
  "nav.playground": "ପରୀକ୍ଷାସ୍ଥଳ",
  "nav.tutorials": "ଟ୍ୟୁଟୋରିଆଲ୍",
  "nav.events": "କାର୍ଯ୍ୟକ୍ରମ",
  "nav.leaderboard": "ମାନଦଣ୍ଡ",
  "nav.about": "ପରିଚୟ",
  "nav.contribute": "ପ୍ରକଳ୍ପ ଯୋଡ଼ନ୍ତୁ",
  "nav.search.aria": "ସନ୍ଧାନ ଖୋଲନ୍ତୁ (Cmd+K)",
  "nav.theme.aria": "ଥିମ୍ ବଦଳାନ୍ତୁ",
  "nav.locale.aria": "ଭାଷା ବଦଳାନ୍ତୁ",
  "nav.menu.aria": "ମେନୁ ବଦଳାନ୍ତୁ",
};
