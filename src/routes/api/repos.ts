import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout, settledValues } from "../../lib/fetch-utils";

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

const USERS: string[] = ["shantipriyap"];

const PINNED_REPOS: string[] = [
  // Original pinned
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

// Safety cap on pagination — current orgs are all well under 100 repos, but
// without this a single org with >100 would be silently truncated.
const MAX_PAGES = 5;

async function fetchOwnerRepos(owner: string, isOrg: boolean): Promise<Repo[]> {
  const kind = isOrg ? "orgs" : "users";
  const all: Repo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const r = await fetchWithTimeout(
        `https://api.github.com/${kind}/${owner}/repos?per_page=100&sort=updated&page=${page}`,
        { headers: GH_HEADERS },
      );
      if (!r.ok) break;
      const batch = (await r.json()) as Repo[];
      all.push(...batch);
      if (batch.length < 100) break;
    } catch (err) {
      console.warn(`fetchOwnerRepos ${owner} page ${page}:`, err);
      break;
    }
  }
  return all;
}

async function fetchSingleRepo(ownerRepo: string): Promise<Repo | null> {
  try {
    const r = await fetchWithTimeout(`https://api.github.com/repos/${ownerRepo}`, {
      headers: GH_HEADERS,
    });
    if (!r.ok) return null;
    return (await r.json()) as Repo;
  } catch (err) {
    console.warn(`fetchSingleRepo ${ownerRepo}:`, err);
    return null;
  }
}

function buildResponse(body: unknown, status: number, cache = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
  };
  if (cache) {
    headers["Cache-Control"] = "public, s-maxage=1800, stale-while-revalidate=86400";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/repos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [orgResults, userResults, pinnedResults] = await Promise.all([
            Promise.all(ORGS.map((o) => fetchOwnerRepos(o, true))),
            Promise.all(USERS.map((u) => fetchOwnerRepos(u, false))),
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

          return buildResponse({ repos }, 200);
        } catch (e) {
          console.error("repos error", e);
          return buildResponse({ repos: [] }, 200, false);
        }
      },
    },
  },
});
