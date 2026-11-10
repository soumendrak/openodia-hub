/**
 * The fixed content of the Pattachitra composition — the parts that are
 * cultural contracts rather than layout, kept here so a test can assert them
 * without rendering a route.
 */

import { getOrganizerById } from "../data/organizers";

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
const odishaAi = getOrganizerById("odishaai");
const odiaGenAi = getOrganizerById("odiagenai");
const gdgCloudBhubaneswar = getOrganizerById("gdg-cloud-bhubaneswar");
const tfugBhubaneswar = getOrganizerById("tfug-bbsr");

export const COMMUNITIES = [
  {
    organizerId: odishaAi.id,
    name: [odishaAi.canonicalName],
    body: odishaAi.description,
    href: odishaAi.officialLinks[0].url,
    cta: "Explore the community",
  },
  {
    organizerId: odiaGenAi.id,
    name: [odiaGenAi.canonicalName],
    body: odiaGenAi.description,
    href: odiaGenAi.officialLinks[0].url,
    cta: "Explore their work",
  },
  {
    organizerId: gdgCloudBhubaneswar.id,
    name: ["GDG Cloud", "Bhubaneswar"],
    body: gdgCloudBhubaneswar.description,
    href: gdgCloudBhubaneswar.officialLinks[0].url,
    cta: "Find your community",
  },
  {
    organizerId: tfugBhubaneswar.id,
    name: ["TFUG", "Bhubaneswar"],
    body: tfugBhubaneswar.description,
    href: tfugBhubaneswar.officialLinks[1].url,
    cta: "Watch community talks",
  },
] as const;
