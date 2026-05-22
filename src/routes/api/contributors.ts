import { createFileRoute } from "@tanstack/react-router";

type Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  repos: string[];
};

const githubToken = process.env.GITHUB_TOKEN;
const GH_HEADERS = {
  "User-Agent": "openodia.com",
  Accept: "application/vnd.github+json",
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
};

const ORGS = ["odisha-ml", "OdiagenAI", "OdiaWikimedia", "ofdn", "OdiaNLP"];
const USERS = ["shantipriyap"];

type GitHubRepo = { name: string; full_name: string; fork: boolean; archived: boolean };

async function fetchRepos(owner: string, isOrg: boolean): Promise<GitHubRepo[]> {
  const endpoint = isOrg
    ? `https://api.github.com/orgs/${owner}/repos?per_page=100&sort=updated`
    : `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated`;
  const r = await fetch(endpoint, { headers: GH_HEADERS });
  if (!r.ok) return [];
  return (await r.json()) as GitHubRepo[];
}

type GitHubContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

async function fetchContributors(fullName: string): Promise<GitHubContributor[]> {
  const r = await fetch(`https://api.github.com/repos/${fullName}/contributors?per_page=30`, {
    headers: GH_HEADERS,
  });
  if (!r.ok) return [];
  return (await r.json()) as GitHubContributor[];
}

export const Route = createFileRoute("/api/contributors")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Fetch repos from all orgs and users
          const orgRepos = await Promise.all(ORGS.map((org) => fetchRepos(org, true)));
          const userRepos = await Promise.all(USERS.map((user) => fetchRepos(user, false)));
          const allRepos = [...orgRepos.flat(), ...userRepos.flat()].filter(
            (r) => !r.fork && !r.archived,
          );

          // Fetch contributors for each repo (limited to prevent rate limiting)
          const reposToFetch = allRepos.slice(0, 20);
          const contributorsPerRepo = await Promise.all(
            reposToFetch.map(async (repo) => {
              const contributors = await fetchContributors(repo.full_name);
              return { repo: repo.name, contributors };
            }),
          );

          // Aggregate: deduplicate by login, sum contributions
          const contributorMap = new Map<string, Contributor>();
          for (const { repo, contributors } of contributorsPerRepo) {
            for (const c of contributors) {
              const existing = contributorMap.get(c.login);
              if (existing) {
                existing.contributions += c.contributions;
                if (!existing.repos.includes(repo)) existing.repos.push(repo);
              } else {
                contributorMap.set(c.login, {
                  login: c.login,
                  avatar_url: c.avatar_url,
                  html_url: c.html_url,
                  contributions: c.contributions,
                  repos: [repo],
                });
              }
            }
          }

          // Sort by contributions desc
          const contributors = Array.from(contributorMap.values()).sort(
            (a, b) => b.contributions - a.contributions,
          );

          return new Response(
            JSON.stringify({
              contributors,
              totalContributors: contributors.length,
              fetchedAt: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, User-Agent",
              },
            },
          );
        } catch (e) {
          console.error("contributors error", e);
          return new Response(
            JSON.stringify({
              contributors: [],
              totalContributors: 0,
              fetchedAt: new Date().toISOString(),
              error: "fetch_failed",
            }),
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
