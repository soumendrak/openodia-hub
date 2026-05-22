import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

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

  const contributors = data?.contributors ?? [];
  const total = data?.totalContributors ?? 0;

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

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-14 animate-pulse rounded-full border-2 border-border bg-surface"
            />
          ))
        ) : isError || contributors.length === 0 ? (
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
            {contributors.map((c) => (
              <a
                key={c.login}
                href={c.html_url}
                target="_blank"
                rel="noreferrer"
                className="group transition-transform hover:scale-110"
                title={`${c.login} · ${c.contributions} contributions across ${c.repos.length} repos`}
              >
                <img
                  src={c.avatar_url}
                  alt={c.login}
                  loading="lazy"
                  className="h-14 w-14 rounded-full border-2 border-border transition group-hover:border-neon"
                />
              </a>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
