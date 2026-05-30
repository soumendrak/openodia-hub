/**
 * Aggregates GitHub contributors across the OpenOdia orgs and writes the
 * result to Cloudflare Workers KV via the Cloudflare REST API.
 *
 * Designed for GitHub Actions (see .github/workflows/sync-contributors.yml).
 * Runs outside the Worker so it isn't bound by the 50-subrequest free-tier cap.
 *
 * Required env:
 *   GITHUB_TOKEN                  GitHub PAT or workflow token (read:org, public_repo)
 *   CLOUDFLARE_ACCOUNT_ID         Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN          API token with Workers KV Storage: Edit on the namespace
 *   CONTRIBUTORS_KV_NAMESPACE_ID  KV namespace ID from `wrangler kv namespace create`
 */

const ORGS = ["odisha-ml", "OdiagenAI", "OdiaWikimedia", "ofdn", "OdiaNLP"];
const USERS = ["shantipriyap"];
const MIN_CONTRIBUTIONS = 10;
const KV_KEY = "contributors:v1";

type GitHubRepo = { name: string; full_name: string; fork: boolean; archived: boolean };

type GitHubContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

type Contributor = GitHubContributor & { repos: string[] };

type Payload = {
  contributors: Contributor[];
  totalContributors: number;
  fetchedAt: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function ghHeaders(token: string): HeadersInit {
  return {
    "User-Agent": "openodia-contributors-sync",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function gh<T>(url: string, token: string): Promise<T | null> {
  const r = await fetch(url, { headers: ghHeaders(token) });
  if (!r.ok) {
    console.warn(`GitHub ${r.status} ${url}`);
    return null;
  }
  const text = await r.text();
  return text ? (JSON.parse(text) as T) : null;
}

async function fetchRepos(owner: string, isOrg: boolean, token: string): Promise<GitHubRepo[]> {
  const kind = isOrg ? "orgs" : "users";
  const data = await gh<GitHubRepo[]>(
    `https://api.github.com/${kind}/${owner}/repos?per_page=100&sort=updated`,
    token,
  );
  return data ?? [];
}

async function fetchContributors(fullName: string, token: string): Promise<GitHubContributor[]> {
  const data = await gh<GitHubContributor[]>(
    `https://api.github.com/repos/${fullName}/contributors?per_page=30`,
    token,
  );
  return data ?? [];
}

async function aggregate(token: string): Promise<Payload> {
  const orgRepos = await Promise.all(ORGS.map((o) => fetchRepos(o, true, token)));
  const userRepos = await Promise.all(USERS.map((u) => fetchRepos(u, false, token)));
  const allRepos = [...orgRepos.flat(), ...userRepos.flat()].filter((r) => !r.fork && !r.archived);

  const perRepo = await Promise.all(
    allRepos.map(async (repo) => ({
      repo: repo.name,
      contributors: await fetchContributors(repo.full_name, token),
    })),
  );

  const map = new Map<string, Contributor>();
  for (const { repo, contributors } of perRepo) {
    for (const c of contributors) {
      const existing = map.get(c.login);
      if (existing) {
        existing.contributions += c.contributions;
        if (!existing.repos.includes(repo)) existing.repos.push(repo);
      } else {
        // Explicit pick — the GitHub API returns ~15 extra URL fields per user
        // that the UI never reads. Picking keeps the KV value (and the
        // /api/contributors response) ~10× smaller.
        map.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
          repos: [repo],
        });
      }
    }
  }

  const contributors = Array.from(map.values())
    .filter((c) => c.contributions > MIN_CONTRIBUTIONS)
    .sort((a, b) => b.contributions - a.contributions);

  return {
    contributors,
    totalContributors: contributors.length,
    fetchedAt: new Date().toISOString(),
  };
}

async function writeToKv(payload: Payload): Promise<void> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const namespaceId = requireEnv("CONTRIBUTORS_KV_NAMESPACE_ID");

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${KV_KEY}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`KV PUT failed: ${r.status} ${body}`);
  }
}

async function main(): Promise<void> {
  const token = requireEnv("GITHUB_TOKEN");
  const payload = await aggregate(token);
  console.log(
    `Aggregated ${payload.totalContributors} contributors (>${MIN_CONTRIBUTIONS} contributions).`,
  );
  await writeToKv(payload);
  console.log(`Wrote KV key "${KV_KEY}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
