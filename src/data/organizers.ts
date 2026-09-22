/**
 * Published organizer identities.
 *
 * This module is deliberately browser-safe: it contains data and pure helpers
 * only. Collection health and event attendance are separate, event-scoped
 * concerns and must not be inferred from this registry.
 */

export const ORGANIZER_KINDS = [
  "community",
  "student-community",
  "institution",
  "government",
  "startup-ecosystem",
  "conference",
] as const;

export const COLLECTION_MODES = ["automated", "partial", "manual", "archive-only"] as const;

export type OrganizerKind = (typeof ORGANIZER_KINDS)[number];
export type CollectionMode = (typeof COLLECTION_MODES)[number];

export type OfficialOrganizerLink = {
  label: string;
  url: string;
  evidenceUrl: string;
  verificationNote: string;
  /** YYYY-MM-DD when someone actually checked the evidence; null means unknown. */
  verifiedOn: string | null;
};

export type Organizer = {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  description: string;
  region: string;
  kind: OrganizerKind;
  collectionMode: CollectionMode;
  officialLinks: readonly OfficialOrganizerLink[];
};

type OrganizerInput = Omit<Organizer, "kind" | "collectionMode"> & {
  kind: string;
  collectionMode: string;
};

const unknownDateNote =
  "Configured as the organizer's official source; the original verification date was not recorded.";

function official(
  label: string,
  url: string,
  verifiedOn: string | null = null,
  verificationNote: string = unknownDateNote,
): OfficialOrganizerLink {
  return { label, url, evidenceUrl: url, verificationNote, verifiedOn };
}

const researchedOn = "2026-09-10";

/** Maintainer-reviewed organizers that may be attached to published events. */
export const ORGANIZERS = [
  {
    id: "odishaai",
    canonicalName: "Odisha AI",
    aliases: ["OdishaAI"],
    description: "People, ideas, and conversations from the wider Odia AI ecosystem.",
    region: "Odisha / global online",
    kind: "community",
    collectionMode: "automated",
    officialLinks: [
      official("Official website", "https://www.odishaai.org/"),
      official("Conference archive", "https://www.odishaai.org/conferences/"),
    ],
  },
  {
    id: "odiagenai",
    canonicalName: "OdiaGenAI",
    aliases: ["Odia Generative AI"],
    description: "Collaborative research and learning around Odia language AI.",
    region: "Odisha / global online",
    kind: "community",
    collectionMode: "partial",
    officialLinks: [official("Official website", "https://www.odiagenai.org/")],
  },
  {
    id: "tfug-bbsr",
    canonicalName: "TFUG Bhubaneswar",
    aliases: ["TFUG BBSR", "TFUG"],
    description: "Technical talks and learning from the local machine learning community.",
    region: "Bhubaneswar",
    kind: "community",
    collectionMode: "manual",
    officialLinks: [
      official("Official event page", "https://www.tfugbbsr.in/event"),
      official("YouTube channel", "https://www.youtube.com/@tfugbbsr"),
    ],
  },
  {
    id: "gdg-bhubaneswar",
    canonicalName: "GDG Bhubaneswar",
    aliases: ["Google Developer Group Bhubaneswar"],
    description: "Google Developer Group serving the Bhubaneswar developer community.",
    region: "Bhubaneswar",
    kind: "community",
    collectionMode: "automated",
    officialLinks: [official("Official chapter", "https://gdg.community.dev/gdg-bhubaneswar/")],
  },
  {
    id: "gdgoc-nist-berhampur",
    canonicalName: "GDGoC NIST Berhampur",
    aliases: ["GDG on Campus NIST Berhampur", "GDG NIST Berhampur"],
    description: "Google Developer Group on Campus at NIST Berhampur.",
    region: "Berhampur",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-national-institute-of-science-and-technology-berhampur-india/",
      ),
    ],
  },
  {
    id: "gdgoc-kiit",
    canonicalName: "GDGoC KIIT",
    aliases: ["GDG on Campus KIIT"],
    description: "Google Developer Group on Campus at KIIT in Bhubaneswar.",
    region: "Bhubaneswar",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india/",
      ),
    ],
  },
  {
    id: "gdgoc-cvr",
    canonicalName: "GDGoC CVR University",
    aliases: ["GDG on Campus C. V. Raman Global University", "GDGoC CGU"],
    description: "Google Developer Group on Campus at C. V. Raman Global University.",
    region: "Bhubaneswar",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-c-v-raman-global-university-bhubaneswar-india/",
      ),
    ],
  },
  {
    id: "gdgoc-iiit-bbsr",
    canonicalName: "GDGoC IIIT Bhubaneswar",
    aliases: ["GDG on Campus IIIT Bhubaneswar"],
    description: "Archived Google Developer Group on Campus identity at IIIT Bhubaneswar.",
    region: "Bhubaneswar",
    kind: "student-community",
    collectionMode: "archive-only",
    officialLinks: [
      official(
        "Archived chapter destination",
        "https://gdg.community.dev/gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india/",
      ),
    ],
  },
  {
    id: "gdgoc-iter-soa",
    canonicalName: "GDGoC ITER SOA",
    aliases: ["GDG on Campus ITER SOA"],
    description: "Google Developer Group on Campus at ITER, SOA University.",
    region: "Bhubaneswar",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india/",
      ),
    ],
  },
  {
    id: "gdgoc-vssut-burla",
    canonicalName: "GDGoC VSSUT Burla",
    aliases: ["GDG on Campus VSSUT Burla"],
    description: "Google Developer Group on Campus at VSSUT in Burla.",
    region: "Burla / Sambalpur",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india/",
      ),
    ],
  },
  {
    id: "gdgoc-nit-rourkela",
    canonicalName: "GDGoC NIT Rourkela",
    aliases: ["GDG on Campus NIT Rourkela"],
    description: "Google Developer Group on Campus at NIT Rourkela.",
    region: "Rourkela",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-national-institute-of-technology-rourkela-india",
      ),
    ],
  },
  {
    id: "gdgoc-giet-gunupur",
    canonicalName: "GDGoC GIET Gunupur",
    aliases: ["GDG on Campus GIET University", "GDGoC GIET University"],
    description: "Google Developer Group on Campus at GIET University in Gunupur.",
    region: "Gunupur",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-giet-university-gunupur-india/",
        researchedOn,
        "The official chapter page and its embedded event payload were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "gdgoc-birla-global",
    canonicalName: "GDGoC Birla Global University",
    aliases: ["GDG on Campus Birla Global University"],
    description: "Google Developer Group on Campus at Birla Global University.",
    region: "Bhubaneswar",
    kind: "student-community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-on-campus-birla-global-university-bhubaneswar-india/",
        researchedOn,
        "The official chapter page and its embedded event payload were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "gdg-cloud-bhubaneswar",
    canonicalName: "GDG Cloud Bhubaneswar",
    aliases: ["Google Developer Group Cloud Bhubaneswar"],
    description: "Cloud, AI, and hands-on learning with the developer community in Bhubaneswar.",
    region: "Bhubaneswar",
    kind: "community",
    collectionMode: "automated",
    officialLinks: [
      official(
        "Official chapter",
        "https://gdg.community.dev/gdg-cloud-bhubaneswar/",
        researchedOn,
        "The official chapter page and its embedded event payload were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "iit-bhubaneswar",
    canonicalName: "IIT Bhubaneswar",
    aliases: ["Indian Institute of Technology Bhubaneswar"],
    description: "An Odisha institute publishing research, workshop, and conference events.",
    region: "Argul / Khordha",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official event archive",
        "https://www.iitbbs.ac.in/index.php/home/events-archives/",
        researchedOn,
        "The institute event archive and linked AI event evidence were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "iiit-bhubaneswar",
    canonicalName: "IIIT Bhubaneswar",
    aliases: [
      "IIIT Bhubaneswar workshops",
      "International Institute of Information Technology Bhubaneswar",
    ],
    description: "An Odisha institute publishing technical workshops and academic events.",
    region: "Bhubaneswar",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official workshop archive",
        "https://www.iiit-bh.ac.in/category/workshops/",
        researchedOn,
        "The institute workshop archive and linked workshop evidence were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "nit-rourkela",
    canonicalName: "NIT Rourkela",
    aliases: ["NIT Rourkela departments", "National Institute of Technology Rourkela"],
    description: "An Odisha institute whose departments publish AI workshops and research events.",
    region: "Rourkela",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official workshop archive",
        "https://www.nitrkl.ac.in/CS/ClosedWorkshops/",
        researchedOn,
        "Official departmental workshop listings and linked brochures were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "fakir-mohan-university",
    canonicalName: "Fakir Mohan University",
    aliases: ["FM University"],
    description: "A public university in Balasore publishing departmental AI notices and events.",
    region: "Balasore",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official department notices",
        "https://fmuniversity.nic.in/dept_notice?dept_id=12",
        researchedOn,
        "The official notice table was checked; event dates still require brochure-level verification.",
      ),
    ],
  },
  {
    id: "ravenshaw-university",
    canonicalName: "Ravenshaw University",
    aliases: [],
    description: "A public university in Cuttack publishing academic event reports.",
    region: "Cuttack",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official event reports",
        "https://ravenshawuniversity.ac.in/eventreportdisp.php",
        researchedOn,
        "The official event-report table was checked during event-radar research.",
      ),
    ],
  },
  {
    id: "osou",
    canonicalName: "Odisha State Open University",
    aliases: ["OSOU"],
    description: "Odisha's state open university, publishing training programmes and workshops.",
    region: "Sambalpur / online",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official training archive",
        "https://osou.ac.in/training-programmes-fdp-workshop.html",
        researchedOn,
        "The official programme table was checked during event-radar research.",
      ),
    ],
  },
  {
    id: "pmec-berhampur",
    canonicalName: "PMEC Berhampur",
    aliases: ["Parala Maharaja Engineering College"],
    description: "A government engineering college in Berhampur publishing technical events.",
    region: "Berhampur",
    kind: "institution",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official event page",
        "https://pmec.ac.in/event/aimlcps-2-26/",
        researchedOn,
        "The official conference detail page was checked during event-radar research.",
      ),
    ],
  },
  {
    id: "soa-oaic",
    canonicalName: "SOA (OAIC)",
    aliases: ["SOA / OAIC 2026", "Odisha AI Conference"],
    description: "The Odisha AI Conference hosted at Siksha 'O' Anusandhan University.",
    region: "Bhubaneswar",
    kind: "conference",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official conference website",
        "https://www.oaic.in/",
        researchedOn,
        "The official conference site identifies OAIC and its host institution.",
      ),
    ],
  },
  {
    id: "startup-odisha",
    canonicalName: "Startup Odisha",
    aliases: ["Startup Odisha / O-Hub", "O-Hub"],
    description: "Odisha's startup ecosystem initiative and O-Hub incubation platform.",
    region: "Bhubaneswar / statewide",
    kind: "startup-ecosystem",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official events",
        "https://startupodisha.gov.in/events/",
        researchedOn,
        "The official government event pages and organizer announcements were checked during event-radar research.",
      ),
    ],
  },
  {
    id: "odisha-eit",
    canonicalName: "Odisha E&IT / OCAC",
    aliases: ["E&IT Odisha", "OCAC", "Odisha Electronics and IT Department"],
    description: "Odisha's Electronics and IT Department and its technical agency, OCAC.",
    region: "Odisha",
    kind: "government",
    collectionMode: "manual",
    officialLinks: [
      official(
        "Official OCAC website",
        "https://ocac.in/",
        researchedOn,
        "The official agency site and government event evidence were checked during event-radar research.",
      ),
    ],
  },
] as const satisfies readonly Organizer[];

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export type PublishedOrganizer = (typeof ORGANIZERS)[number];
export type OrganizerId = PublishedOrganizer["id"];

const organizerById = new Map<string, PublishedOrganizer>(
  ORGANIZERS.map((organizer) => [organizer.id, organizer]),
);
const organizerByName = new Map<string, PublishedOrganizer>(
  ORGANIZERS.flatMap((organizer) =>
    [organizer.canonicalName, ...organizer.aliases].map((name) => [
      normalizeIdentity(name),
      organizer,
    ]),
  ),
);

export function getOrganizerById<I extends OrganizerId>(
  id: I,
): Extract<PublishedOrganizer, { id: I }>;
export function getOrganizerById(id: string): PublishedOrganizer | undefined;
export function getOrganizerById(id: string): PublishedOrganizer | undefined {
  return organizerById.get(id);
}

/** Resolves a stable ID, canonical display name, or reviewed legacy alias. */
export function resolveOrganizer(identity: string): PublishedOrganizer | undefined {
  return organizerById.get(identity) ?? organizerByName.get(normalizeIdentity(identity));
}

export function resolveOrganizerId(identity: string): OrganizerId | undefined {
  return resolveOrganizer(identity)?.id;
}

export function resolveOrganizerName(identity: string): string | undefined {
  return resolveOrganizer(identity)?.canonicalName;
}

export function findUnresolvedOrganizerNames(names: readonly string[]): string[] {
  return [...new Set(names.filter((name) => !resolveOrganizer(name)))].sort();
}

/** Returns all registry defects without throwing, so CI and review tools can report them together. */
export function validateOrganizerRegistry(registry: readonly OrganizerInput[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const identities = new Map<string, string>();
  const kinds = new Set<string>(ORGANIZER_KINDS);
  const modes = new Set<string>(COLLECTION_MODES);

  for (const organizer of registry) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizer.id)) {
      errors.push(`Organizer ID is not URL-safe: ${organizer.id}`);
    }
    if (ids.has(organizer.id)) errors.push(`Duplicate organizer ID: ${organizer.id}`);
    ids.add(organizer.id);

    if (!kinds.has(organizer.kind)) {
      errors.push(`Unsupported organizer kind for ${organizer.id}: ${organizer.kind}`);
    }
    if (!modes.has(organizer.collectionMode)) {
      errors.push(`Unsupported collection mode for ${organizer.id}: ${organizer.collectionMode}`);
    }

    for (const identity of [organizer.canonicalName, ...organizer.aliases]) {
      const key = normalizeIdentity(identity);
      const owner = identities.get(key);
      if (owner) {
        errors.push(
          owner === organizer.id
            ? `Duplicate organizer identity for ${organizer.id}: ${JSON.stringify(identity)}`
            : `Organizer identity ${JSON.stringify(identity)} is shared by ${owner} and ${organizer.id}`,
        );
      } else {
        identities.set(key, organizer.id);
      }
    }

    if (organizer.officialLinks.length === 0) {
      errors.push(`Organizer has no official links: ${organizer.id}`);
    }
    for (const link of organizer.officialLinks) {
      try {
        const url = new URL(link.url);
        if (url.protocol !== "https:") throw new Error();
      } catch {
        errors.push(`Malformed official link for ${organizer.id}: ${link.url}`);
      }
      try {
        const evidenceUrl = new URL(link.evidenceUrl);
        if (evidenceUrl.protocol !== "https:") throw new Error();
      } catch {
        errors.push(`Malformed evidence URL for ${organizer.id}: ${link.evidenceUrl}`);
      }
      if (!link.verificationNote.trim()) {
        errors.push(`Missing verification note for ${organizer.id}: ${link.url}`);
      }
      if (link.verifiedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(link.verifiedOn)) {
        errors.push(`Malformed verification date for ${organizer.id}: ${link.verifiedOn}`);
      }
    }
  }

  return errors;
}
