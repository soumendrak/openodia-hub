import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";

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
  try {
    const url = `https://api.github.com/repos/${REPO}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&sort=updated&direction=desc`;
    const r = await fetchWithTimeout(url, { headers: GH_HEADERS });
    if (!r.ok) return [];
    const issues = (await r.json()) as RoadmapIssue[];
    // Filter out pull requests (GitHub Issues API returns PRs too)
    return issues.filter((i) => !(i as unknown as { pull_request?: unknown }).pull_request);
  } catch (err) {
    console.warn(`fetchLabeledIssues ${label}:`, err);
    return [];
  }
}

export const Route = createFileRoute("/api/roadmap")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Preserve label order by mapping rejected promises to []. settledValues
          // would compact and break the positional zip with ROADMAP_LABELS.
          const settled = await Promise.allSettled(ROADMAP_LABELS.map(fetchLabeledIssues));
          const grouped = settled.map((r) => (r.status === "fulfilled" ? r.value : []));

          const groups: RoadmapGroup[] = [
            { status: "planned", label: "Planned", issues: grouped[0] },
            { status: "in-progress", label: "In Progress", issues: grouped[1] },
            { status: "completed", label: "Completed", issues: grouped[2] },
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
            JSON.stringify({
              groups: [],
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
