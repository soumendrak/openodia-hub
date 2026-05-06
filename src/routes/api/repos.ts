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
  topics?: string[];
};

async function fetchRepos(path: string): Promise<Repo[]> {
  const r = await fetch(`https://api.github.com/${path}?per_page=100&sort=updated`, {
    headers: {
      "User-Agent": "openodia.com",
      Accept: "application/vnd.github+json",
    },
  });
  if (!r.ok) return [];
  return (await r.json()) as Repo[];
}

export const Route = createFileRoute("/api/repos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [user, org] = await Promise.all([
            fetchRepos("users/soumendrak/repos"),
            fetchRepos("orgs/odisha-ml/repos"),
          ]);
          const repos = [...user, ...org]
            .filter((r) => !r.fork && !r.archived)
            .filter((r) => r.name.toLowerCase() !== "openodia") // featured separately
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
