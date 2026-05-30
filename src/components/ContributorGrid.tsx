import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Star, GitFork, ExternalLink, ChevronUp } from "lucide-react";

type RepoDetail = {
  name: string;
  full_name: string;
  contributions: number;
  stars: number;
  html_url: string;
};

// v1 stored repos as string[]; v2 stores RepoDetail[]
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

function isV2(c: Contrib): c is V2Contributor {
  return c.repos.length > 0 && typeof c.repos[0] !== "string";
}

function RepoRow({ repo }: { repo: RepoDetail | string }) {
  if (typeof repo === "string") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface/40 px-3 py-2 text-sm">
        <GitFork size={14} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {repo}
        </span>
        <span className="shrink-0 rounded-full bg-surface/60 px-2 py-0.5 text-[10px] text-muted-foreground">
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
      className="group flex items-center gap-3 rounded-lg border border-border/50 bg-surface/40 px-3 py-2 text-sm transition hover:border-neon/30 hover:bg-surface/60"
    >
      <GitFork size={14} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{repo.full_name}</span>
      <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
        <Star size={12} />
        {repo.stars}
      </span>
      <span className="shrink-0 rounded-full bg-neon/10 px-2 py-0.5 tabular-nums text-xs text-neon">
        {repo.contributions} {repo.contributions === 1 ? "commit" : "commits"}
      </span>
      <ExternalLink
        size={12}
        className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
      />
    </a>
  );
}

function RepoList({ repos }: { repos: (RepoDetail | string)[] }) {
  if (repos.length === 0) {
    return <p className="text-xs text-muted-foreground">No Odia repos tracked.</p>;
  }
  return (
    <>
      {repos.map((r, ri) => (
        <RepoRow key={typeof r === "string" ? `${r}-${ri}` : r.full_name} repo={r} />
      ))}
    </>
  );
}

function contribCount(c: Contrib): number {
  return c.contributions;
}

function contribRepos(c: Contrib): string {
  return `${c.repos.length} ${c.repos.length === 1 ? "repo" : "repos"}`;
}

export function ContributorGrid() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contributors"],
    queryFn: async () => {
      const r = await fetch("/api/contributors");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Resp;
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });

  const rawContributors = data?.contributors ?? [];
  const total = data?.totalContributors ?? 0;
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (login: string) => {
    setExpanded((prev) => (prev === login ? null : login));
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold md:text-5xl">
          {total > 0 ? `${total}+ contributors` : "Community contributors"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Building Odia AI together — from across the community.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-start justify-center gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-14 animate-pulse rounded-full border-2 border-border bg-surface"
            />
          ))
        ) : isError || rawContributors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Users size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Contributor data is being gathered from GitHub.
            </p>
            <a
              href="https://github.com/soumendrak/openodia-hub"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-neon hover:underline"
            >
              Join us on GitHub →
            </a>
          </div>
        ) : (
          <>
            {rawContributors.map((c) => {
              const isOpen = expanded === c.login;
              return (
                <div key={c.login} className="flex flex-col items-center">
                  <button
                    onClick={() => toggle(c.login)}
                    className="group flex flex-col items-center transition-transform hover:scale-110"
                    title={`${c.login} · ${contribCount(c)} contributions across ${c.repos.length} repos`}
                  >
                    <div className="relative">
                      <img
                        src={c.avatar_url}
                        alt={c.login}
                        loading="lazy"
                        className="h-14 w-14 rounded-full border-2 border-border transition group-hover:border-neon"
                      />
                      {isOpen && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                          <ChevronUp size={14} className="text-neon" />
                        </div>
                      )}
                    </div>
                    <span className="mt-1 max-w-[5rem] truncate text-[10px] text-muted-foreground">
                      @{c.login}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="z-10 mt-2 w-72 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="rounded-xl border border-border bg-surface p-4 shadow-lg">
                        {/* Profile header */}
                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-3 flex items-center gap-2 text-sm font-semibold text-neon hover:underline"
                        >
                          @{c.login}
                          <ExternalLink size={12} />
                        </a>

                        {/* Repo list */}
                        <RepoList repos={c.repos} />

                        {/* Footer stats */}
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
                          <span>Total: {contribCount(c).toLocaleString()} commits</span>
                          <span>{contribRepos(c)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
