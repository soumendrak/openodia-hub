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

const ORGS: string[] = ["odisha-ml", "OdiagenAI", "OdiaWikimedia", "ofdn", "OdiaNLP"];

const USERS: string[] = ["shantipriyap"];

const PINNED_REPOS: string[] = ["soumendrak/aidaybbsr2025demo", "soumendrak/odia-2048"];

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
            },
          });
        } catch (e) {
          console.error("repos error", e);
          return Response.json({ repos: [] }, { status: 200 });
        }
      },
    },
  },
});
