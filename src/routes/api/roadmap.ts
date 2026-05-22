import { createFileRoute } from "@tanstack/react-router";

type RoadmapIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  body?: string;
};

type RoadmapGroup = {
  status: string;
  label: string;
  issues: RoadmapIssue[];
};

const githubToken = process.env.GITHUB_TOKEN;
const GH_HEADERS = {
  "User-Agent": "openodia.com",
  Accept: "application/vnd.github+json",
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
};

const REPO = "soumendrak/openodia-hub";
const ROADMAP_LABELS = ["roadmap:planned", "roadmap:in-progress", "roadmap:completed"];

async function fetchLabeledIssues(label: string): Promise<RoadmapIssue[]> {
  const url = `https://api.github.com/repos/${REPO}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&sort=updated&direction=desc`;
  const r = await fetch(url, { headers: GH_HEADERS });
  if (!r.ok) return [];
  const issues = (await r.json()) as RoadmapIssue[];
  // Filter out pull requests (GitHub Issues API returns PRs too)
  return issues.filter((i) => !(i as unknown as { pull_request?: unknown }).pull_request);
}

export const Route = createFileRoute("/api/roadmap")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const results = await Promise.all(ROADMAP_LABELS.map(fetchLabeledIssues));

          const groups: RoadmapGroup[] = [
            { status: "planned", label: "Planned", issues: results[0] },
            { status: "in-progress", label: "In Progress", issues: results[1] },
            { status: "completed", label: "Completed", issues: results[2] },
          ];

          return new Response(JSON.stringify({ groups, fetchedAt: new Date().toISOString() }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, User-Agent",
            },
          });
        } catch (e) {
          console.error("roadmap error", e);
          return new Response(
            JSON.stringify({ groups: [], fetchedAt: new Date().toISOString(), error: "fetch_failed" }),
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
