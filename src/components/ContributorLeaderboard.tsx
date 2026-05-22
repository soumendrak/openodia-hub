import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal } from "lucide-react";

type Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  repos: string[];
};

type Resp = {
  contributors: Contributor[];
  totalContributors: number;
};

function rankIcon(rank: number) {
  if (rank === 1)
    return <Trophy size={14} className="text-saffron" />;
  if (rank === 2)
    return <Medal size={14} className="text-muted-foreground" />;
  if (rank === 3)
    return <Medal size={14} className="text-amber-700" />;
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {rank}
    </span>
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
  });

  const contributors = data?.contributors ?? [];

  if (contributors.length === 0) return null;

  const top = contributors.slice(0, limit);

  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold md:text-5xl">
          Top contributors
        </h2>
        <p className="mt-2 text-muted-foreground">
          The people building open-source Odia AI — ranked by total contributions.
        </p>
      </div>

      <div className="mt-8 space-y-2">
        {top.map((c, i) => (
          <a
            key={c.login}
            href={c.html_url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-neon/30"
          >
            {/* Rank */}
            <div className="grid h-8 w-8 shrink-0 place-items-center">
              {rankIcon(i + 1)}
            </div>

            {/* Avatar */}
            <img
              src={c.avatar_url}
              alt={c.login}
              className="h-10 w-10 shrink-0 rounded-full border border-border"
            />

            {/* Name + stats */}
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">@{c.login}</p>
              <p className="text-xs text-muted-foreground">
                {c.contributions} contributions · {c.repos.length}{" "}
                {c.repos.length === 1 ? "repo" : "repos"}
              </p>
            </div>

            {/* Arrow */}
            <span className="shrink-0 text-xs text-muted-foreground transition group-hover:text-neon">
              →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
