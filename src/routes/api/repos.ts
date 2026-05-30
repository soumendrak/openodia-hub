import { createFileRoute } from "@tanstack/react-router";

type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  created_at: string;
  topics?: string[];
};

const ORGS: string[] = [
  "odisha-ml",
  "OdiagenAI",
  "OdiaWikimedia",
  "ofdn",
  "OdiaNLP",
  "Odia-Digital",
];

const USERS: string[] = [
  "shantipriyap",
];

const PINNED_REPOS: string[] = [
  "soumendrak/aidaybbsr2025demo",
  "soumendrak/odia-2048",
  // Google Noto fonts
  "notofonts/noto-sans-oriya",
  "notofonts/oriya",
  // SIL font variant
  "silnrsi/font-japa-sans-oriya",
  // Hunspell / hyphenation / Lohit
  "gooselinux/hunspell-or",
  "gooselinux/hyphen-or",
  "gooselinux/lohit-oriya-fonts",
  "lohit-fonts/lohit-odia-fonts",
  // NLCI Oriya fonts & keyboard
  "nlci/orya-font-asika",
  "nlci/orya-font-sans",
  "nlci/orya-keybd-winscript",
  // Aspell
  "pld-linux/aspell-or",
  // Individual high-value repos
  "imsbg/odiabhasa",
  "imsbg/odia-bhasa",
  "imsbg/odiaapp",
  "imsbg/odiagames",
  "imsbg/odialipi",
  "imsbg/Ganita-Bingya-App",
  "imsbg/Atomic-Guru",
  "coldbreeze16/Lekhani",
  "coldbreeze16/Kunji-Binyasa",
  "coldbreeze16/Meghaduta-Converter",
  "dmort27/orimorph",
  "dmort27/odia-tools",
  "dmort27/odia-im",
  "goru001/nlp-for-odia",
  "sovopr/sovogpt",
  "jyotishankar04/odialang",
  "Deeptiman/Alphabet-Learning-Android-Application",
  "Deeptiman/php-dom-parser-translation-tool",
  "nsoum/odia-tex",
  "SantoshNayak/Odia-Calendar",
  "gyan111/gyan111.github.io",
  "gyan111/twinkle-orwiki",
  "odiaorg/purnachandraBhasakosha",
  "odiaorg/odiaDictColln",
  "shrixtacy/Subhadra-AI",
  "HimanshuMohanty-Git24/OdiaLingua",
  "GnsP/odia-keyboard",
  "sushantamishra79/Odia-TTS-Dataset",
  "mohitkdas/OdiaCalendarArchive",
  "RajeebLochan/Sweatable",
];

const githubToken = process.env.GITHUB_TOKEN;
const GH_HEADERS = {
  "User-Agent": "openodia.com",
  Accept: "application/vnd.github+json",
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
};

async function fetchOrgRepos(org: string): Promise<Repo[]> {
  const r = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated`, {
    headers: GH_HEADERS,
  });
  if (!r.ok) return [];
  return (await r.json()) as Repo[];
}

async function fetchUserRepos(user: string): Promise<Repo[]> {
  const r = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=updated`, {
    headers: GH_HEADERS,
  });
  if (!r.ok) return [];
  return (await r.json()) as Repo[];
}

async function fetchSingleRepo(ownerRepo: string): Promise<Repo | null> {
  const r = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
    headers: GH_HEADERS,
  });
  if (!r.ok) return null;
  return (await r.json()) as Repo;
}

export const Route = createFileRoute("/api/repos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [orgResults, userResults, pinnedResults] = await Promise.all([
            Promise.all(ORGS.map(fetchOrgRepos)),
            Promise.all(USERS.map(fetchUserRepos)),
            Promise.all(PINNED_REPOS.map(fetchSingleRepo)),
          ]);
          const pinnedRepos = pinnedResults.filter(Boolean) as Repo[];
          const pinnedNames = new Set(pinnedRepos.map((r) => r.full_name));
          const repos = [...orgResults.flat(), ...userResults.flat()]
            .filter((r) => !r.fork && !r.archived)
            .filter((r) => r.name.toLowerCase() !== "openodia") // featured separately
            .filter((r) => !pinnedNames.has(r.full_name)) // avoid duplicates with pinned
            .concat(pinnedRepos)
            .sort((a, b) => b.stargazers_count - a.stargazers_count);

          return new Response(JSON.stringify({ repos }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, User-Agent",
            },
          });
        } catch (e) {
          console.error("repos error", e);
          return new Response(
            JSON.stringify({ repos: [] }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
              },
            },
          );
        }
      },
    },
  },
});
