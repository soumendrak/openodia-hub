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

const ORGS: string[] = ["odisha-ml", "OdiagenAI", "OdiaWikimedia", "ofdn", "OdiaNLP"];

const USERS: string[] = ["shantipriyap"];

const PINNED_REPOS: string[] = [
  "soumendrak/aidaybbsr2025demo",
  "soumendrak/odia-2048",
  "goru001/nlp-for-odia",
  "Deeptiman/Alphabet-Learning-Android-Application",
  "jyotishankar04/odialang",
  "HimanshuMohanty-Git24/OdiaLingua",
  "imsbg/odiabhasa",
  "shrixtacy/Subhadra-AI",
  "sovopr/sovogpt",
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
      GET: async ({ request }: { request: Request }) => {
        try {
          const [orgResults, userResults, pinnedResults] = await Promise.all([
            Promise.allSettled(ORGS.map((o) => fetchOwnerRepos(o, true))).then(settledValues),
            Promise.allSettled(USERS.map((u) => fetchOwnerRepos(u, false))).then(settledValues),
            Promise.allSettled(PINNED_REPOS.map(fetchSingleRepo)).then(settledValues),
          ]);
          const pinnedRepos = pinnedResults.filter(Boolean) as Repo[];
          const pinnedNames = new Set(pinnedRepos.map((r) => r.full_name));
          const allRepos = [...orgResults.flat(), ...userResults.flat()]
            .filter((r) => !r.fork && !r.archived)
            .filter((r) => r.name.toLowerCase() !== "openodia")
            .filter((r) => !pinnedNames.has(r.full_name))
            .concat(pinnedRepos)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          const url = new URL(request.url);
          const cursorParam = url.searchParams.get("cursor");

          if (cursorParam === null) {
            return buildResponse({ repos: allRepos }, 200);
          }

          const limit = Math.min(parseInt(url.searchParams.get("limit") || "24", 10) || 24, 50);
          const start = parseInt(cursorParam || "0", 10) || 0;
          const pageRepos = allRepos.slice(start, start + limit);
          const nextCursor = start + limit < allRepos.length ? String(start + limit) : undefined;

          return buildResponse({ repos: pageRepos, nextCursor, total: allRepos.length }, 200);
        } catch (e) {
          console.error("repos error", e);
          return buildResponse({ repos: [] }, 200, false);
        }
      },
    },
  },
});
