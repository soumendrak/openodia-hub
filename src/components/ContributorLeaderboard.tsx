import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Star, GitFork, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

type RepoDetail = {
  name: string;
  full_name: string;
  contributions: number;
  stars: number;
  html_url: string;
};

type V1Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  repos: string[];
};

type V2Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  repos: RepoDetail[];
};

type Contrib = V1Contributor | V2Contributor;

type Resp = {
  contributors: Contrib[];
  totalContributors: number;
};

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy size={14} className="text-saffron" />;
  if (rank === 2) return <Medal size={14} className="text-muted-foreground" />;
  if (rank === 3) return <Medal size={14} className="text-amber-700" />;
  return <span className="font-mono text-xs tabular-nums text-muted-foreground">{rank}</span>;
}

function RepoRow({ repo }: { repo: RepoDetail | string }) {
  if (typeof repo === "string") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface/30 px-3 py-1.5 text-xs">
        <GitFork size={12} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{repo}</span>
        <span className="shrink-0 rounded-full bg-surface/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          (refreshing…)
        </span>
      </div>
    );
  }

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-surface/30 px-3 py-1.5 text-xs transition hover:border-neon/30 hover:bg-surface/50"
    >
      <GitFork size={12} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono">{repo.full_name}</span>
      <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
        <Star size={10} />
        {repo.stars}
      </span>
      <span className="shrink-0 rounded-full bg-neon/10 px-1.5 py-0.5 tabular-nums text-[10px] text-neon">
        {repo.contributions}
      </span>
    </a>
  );
}

function RepoList({ repos }: { repos: (RepoDetail | string)[] }) {
  if (repos.length === 0) {
    return <p className="text-xs text-muted-foreground">No Odia repos tracked.</p>;
  }
  return (
    <div className="space-y-1">
      {repos.map((r, ri) => (
        <RepoRow key={typeof r === "string" ? `${r}-${ri}` : r.full_name} repo={r} />
      ))}
    </div>
  );
}

export function ContributorLeaderboard({ limit = 5 }: { limit?: number }) {
  const { data } = useQuery({
    queryKey: ["contributors"],
    queryFn: async () => {
      const r = await fetch("/api/contributors");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Resp;
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  const contributors = data?.contributors ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (login: string) => {
    setExpanded((prev) => (prev === login ? null : login));
  };

  if (contributors.length === 0) return null;

  const top = contributors.slice(0, limit);

  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold md:text-5xl">Top contributors</h2>
        <p className="mt-2 text-muted-foreground">
          The people building open-source Odia AI — ranked by total contributions.
        </p>
      </div>

      <div className="mt-8 space-y-2">
        {top.map((c, i) => {
          const isOpen = expanded === c.login;
          return (
            <div key={c.login}>
              <button
                onClick={() => toggle(c.login)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-neon/30"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center">{rankIcon(i + 1)}</div>
                <img
                  src={c.avatar_url}
                  alt={c.login}
                  className="h-10 w-10 shrink-0 rounded-full border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold">@{c.login}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.contributions.toLocaleString()} contributions · {c.repos.length}{" "}
                    {c.repos.length === 1 ? "repo" : "repos"}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground transition group-hover:text-neon">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="mx-2 rounded-b-xl border-x border-b border-border bg-surface/60 p-4 shadow-lg">
                    <a
                      href={c.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-neon hover:underline"
                    >
                      View GitHub profile <ExternalLink size={10} />
                    </a>
                    <RepoList repos={c.repos} />
                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                      <span>{c.contributions.toLocaleString()} total commits</span>
                      <span>
                        {c.repos.length} {c.repos.length === 1 ? "repo" : "repos"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
