/**
 * The fixed content of the Pattachitra composition — the parts that are
 * cultural contracts rather than layout, kept here so a test can assert them
 * without rendering a route.
 */

/**
 * The hero phrase, as the maintainer wrote it: no danda, not anywhere. It is
 * easy to get wrong and hard to notice, so a test pins it exactly — if that
 * test goes red, check whether someone changed the phrase on purpose before
 * "restoring" it. Rendered in the hero and the footer.
 */
export const ODIA_PHRASE = "ଆମ ଭାଷା ଆମ ପରିଚୟ";

/** The three ecosystem pillars, each a route on this site. */
export const COLLECTION = [
  {
    to: "/tools",
    emblem: "ଅ",
    emblemLang: "or" as const,
    eyebrow: "Write · Create · Express",
    title: ["Give your ideas", "a language."],
    body: "Fonts, keyboards, transliteration, OCR, and tools for everyday Odia.",
    cta: "Explore tools",
  },
  {
    to: "/models",
    emblem: "≋",
    emblemLang: undefined,
    eyebrow: "Listen · Understand · Build",
    title: ["Let our language", "shape what’s next."],
    body: "Odia language and speech models, with licences and ready-to-paste citations.",
    cta: "Discover models",
  },
  {
    to: "/datasets",
    emblem: "✺",
    emblemLang: undefined,
    eyebrow: "Explore · Research · Discover",
    title: ["Start with something", "worth building on."],
    body: "Open Odia datasets to explore, study, and move your ideas forward.",
    cta: "Browse datasets",
  },
] as const;

/**
 * Independent communities. OpenOdia links to them; it does not run them —
 * every entry points at the community's own home, and the grid carries a note
 * saying so. Changing a link here changes an attribution claim, so the set is
 * covered by a test.
 */
export const COMMUNITIES = [
  {
    name: ["Odisha AI"],
    body: "People, ideas, and conversations from the wider Odia AI ecosystem.",
    href: "https://www.odishaai.org/",
    cta: "Explore the community",
  },
  {
    name: ["OdiaGenAI"],
    body: "Collaborative research and learning around Odia language AI.",
    href: "https://www.odiagenai.org/",
    cta: "Explore their work",
  },
  {
    name: ["GDG Cloud", "Bhubaneswar"],
    body: "Cloud, AI, and hands-on learning with the developer community in Bhubaneswar.",
    href: "https://gdg.community.dev/gdg-cloud-bhubaneswar/",
    cta: "Find your community",
  },
  {
    name: ["TFUG", "Bhubaneswar"],
    body: "Technical talks and learning from the local machine learning community.",
    href: "https://www.youtube.com/@tfugbbsr",
    cta: "Watch community talks",
  },
] as const;
