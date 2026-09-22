/**
 * Published organizer identities.  This module is intentionally browser-safe:
 * it is the compatibility boundary between legacy event display names and
 * stable URLs such as /events?community=gdg-bhubaneswar.
 */
export type OrganizerKind = "community" | "campus-chapter" | "institution" | "government";
export type CollectionMode = "automated" | "partial" | "manual" | "archive-only";

export type Organizer = {
  id: string;
  name: string;
  aliases: readonly string[];
  region: string;
  kind: OrganizerKind;
  description: string;
  officialUrl: string;
  evidenceUrl: string;
  collectionMode: CollectionMode;
  verificationNote: string;
};

const gdg = (id: string, name: string, slug: string, region: string): Organizer => ({
  id,
  name,
  aliases: [name],
  region,
  kind: id.includes("gdgoc") ? "campus-chapter" : "community",
  description: `${name} is a Google developer community with events in ${region}.`,
  officialUrl: `https://gdg.community.dev/${slug}/`,
  evidenceUrl: `https://gdg.community.dev/${slug}/`,
  collectionMode: [
    "gdg-bhubaneswar",
    "gdgoc-nist-berhampur",
    "gdgoc-kiit",
    "gdgoc-cvr",
    "gdgoc-iiit-bhubaneswar",
    "gdgoc-iter-soa",
  ].includes(id)
    ? "automated"
    : "manual",
  verificationNote: "Official community destination is the event-source provenance.",
});

const manual = (
  id: string,
  name: string,
  kind: OrganizerKind,
  region: string,
  officialUrl: string,
  description: string,
): Organizer => ({
  id,
  name,
  aliases: [name],
  kind,
  region,
  description,
  officialUrl,
  evidenceUrl: officialUrl,
  collectionMode: "manual",
  verificationNote: "Official destination is recorded from checked-in event provenance.",
});

export const ORGANIZERS: readonly Organizer[] = [
  manual(
    "odisha-ai",
    "Odisha AI",
    "community",
    "Odisha",
    "https://www.odishaai.org/conferences/",
    "An Odisha AI community that publishes conferences and events.",
  ),
  manual(
    "odiagenai",
    "OdiaGenAI",
    "community",
    "Odisha",
    "https://www.odiagenai.org/",
    "A community initiative for Odia generative AI.",
  ),
  manual(
    "tfug-bhubaneswar",
    "TFUG Bhubaneswar",
    "community",
    "Bhubaneswar, Odisha",
    "https://www.tfugbbsr.in/event",
    "A TensorFlow user group in Bhubaneswar.",
  ),
  gdg("gdg-bhubaneswar", "GDG Bhubaneswar", "gdg-bhubaneswar", "Bhubaneswar, Odisha"),
  gdg(
    "gdgoc-nist-berhampur",
    "GDGoC NIST Berhampur",
    "gdg-on-campus-national-institute-of-science-and-technology-berhampur-india",
    "Berhampur, Odisha",
  ),
  gdg(
    "gdgoc-kiit",
    "GDGoC KIIT",
    "gdg-on-campus-kalinga-institute-of-industrial-technology-bhubaneswar-india",
    "Bhubaneswar, Odisha",
  ),
  gdg(
    "gdgoc-cvr",
    "GDGoC CVR University",
    "gdg-on-campus-c-v-raman-global-university-bhubaneswar-india",
    "Bhubaneswar, Odisha",
  ),
  gdg(
    "gdgoc-iiit-bhubaneswar",
    "GDGoC IIIT Bhubaneswar",
    "gdg-on-campus-international-institute-of-information-technology-bhubaneswar-india",
    "Bhubaneswar, Odisha",
  ),
  gdg(
    "gdgoc-iter-soa",
    "GDGoC ITER SOA",
    "gdg-on-campus-institute-of-technical-education-research-bhubaneswar-india",
    "Bhubaneswar, Odisha",
  ),
  gdg(
    "gdgoc-vssut-burla",
    "GDGoC VSSUT Burla",
    "gdg-on-campus-veer-surendra-sai-university-of-technology-burla-india",
    "Burla, Odisha",
  ),
  gdg(
    "gdgoc-nit-rourkela",
    "GDGoC NIT Rourkela",
    "gdg-on-campus-national-institute-of-technology-rourkela-india",
    "Rourkela, Odisha",
  ),
  gdg(
    "gdgoc-giet-gunupur",
    "GDGoC GIET Gunupur",
    "gdg-on-campus-giet-university-gunupur-india",
    "Gunupur, Odisha",
  ),
  gdg(
    "gdgoc-birla-global",
    "GDGoC Birla Global University",
    "gdg-on-campus-birla-global-university-bhubaneswar-india",
    "Bhubaneswar, Odisha",
  ),
  gdg(
    "gdg-cloud-bhubaneswar",
    "GDG Cloud Bhubaneswar",
    "gdg-cloud-bhubaneswar",
    "Bhubaneswar, Odisha",
  ),
  manual(
    "iit-bhubaneswar",
    "IIT Bhubaneswar",
    "institution",
    "Bhubaneswar, Odisha",
    "https://www.iitbbs.ac.in/index.php/home/events-archives/",
    "Indian Institute of Technology Bhubaneswar event archive.",
  ),
  manual(
    "iiit-bhubaneswar",
    "IIIT Bhubaneswar",
    "institution",
    "Bhubaneswar, Odisha",
    "https://www.iiit-bh.ac.in/category/workshops/",
    "International Institute of Information Technology Bhubaneswar workshops.",
  ),
  manual(
    "nit-rourkela",
    "NIT Rourkela",
    "institution",
    "Rourkela, Odisha",
    "https://www.nitrkl.ac.in/CS/ClosedWorkshops/",
    "National Institute of Technology Rourkela workshops.",
  ),
  manual(
    "fakir-mohan-university",
    "Fakir Mohan University",
    "institution",
    "Balasore, Odisha",
    "https://fmuniversity.nic.in/dept_notice?dept_id=12",
    "Fakir Mohan University department notices.",
  ),
  manual(
    "ravenshaw-university",
    "Ravenshaw University",
    "institution",
    "Cuttack, Odisha",
    "https://ravenshawuniversity.ac.in/eventreportdisp.php",
    "Ravenshaw University event reports.",
  ),
  manual(
    "odisha-state-open-university",
    "Odisha State Open University",
    "institution",
    "Sambalpur, Odisha",
    "https://osou.ac.in/training-programmes-fdp-workshop.html",
    "Odisha State Open University training and workshop notices.",
  ),
  manual(
    "pmec-berhampur",
    "PMEC Berhampur",
    "institution",
    "Berhampur, Odisha",
    "https://pmec.ac.in/event/aimlcps-2-26/",
    "Parala Maharaja Engineering College event notices.",
  ),
  manual(
    "soa-oaic",
    "SOA (OAIC)",
    "institution",
    "Bhubaneswar, Odisha",
    "https://www.oaic.in/",
    "Siksha 'O' Anusandhan AI and cloud initiative.",
  ),
  manual(
    "startup-odisha",
    "Startup Odisha",
    "government",
    "Odisha",
    "https://startupodisha.gov.in/",
    "Government of Odisha startup initiative.",
  ),
  manual(
    "odisha-eit-ocac",
    "Odisha E&IT / OCAC",
    "government",
    "Odisha",
    "https://ocac.in/",
    "Odisha government electronics and IT organization.",
  ),
];

const byId = new Map(ORGANIZERS.map((organizer) => [organizer.id, organizer]));
const aliases = new Map(
  ORGANIZERS.flatMap((organizer) =>
    [organizer.name, ...organizer.aliases].map(
      (name) => [name.toLocaleLowerCase(), organizer.id] as const,
    ),
  ),
);

export function getOrganizer(id: string | undefined): Organizer | undefined {
  return id ? byId.get(id) : undefined;
}

export function resolveOrganizerId(name: string | undefined): string | undefined {
  return name ? aliases.get(name.toLocaleLowerCase()) : undefined;
}

export function organizerName(name: string | undefined): string | undefined {
  const organizer = getOrganizer(resolveOrganizerId(name));
  return organizer?.name;
}

export function organizerSearchText(name: string | undefined): string {
  const organizer = getOrganizer(resolveOrganizerId(name));
  return organizer ? [organizer.name, ...organizer.aliases].join(" ") : (name ?? "");
}
