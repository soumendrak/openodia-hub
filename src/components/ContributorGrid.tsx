import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";

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
  const total = data?.totalContributors ?? 0;

  if (contributors.length === 0) return null;

  const displayed = contributors.slice(0, 12);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="text-center">
        <h2 className="font-display text-3xl font-semibold md:text-5xl">{total}+ contributors</h2>
        <p className="mt-2 text-muted-foreground">
          Building Odia AI together — from across the community.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {displayed.map((c, i) => (
            <motion.a
              key={c.login}
              href={c.html_url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 15 }}
              whileHover={{ y: -4, scale: 1.1 }}
              className="group relative"
              title={`${c.login} · ${c.contributions} contributions`}
            >
              <img
                src={c.avatar_url}
                alt={c.login}
                loading="lazy"
                className="h-14 w-14 rounded-full border-2 border-border transition group-hover:border-neon"
              />
            </motion.a>
          ))}

          {total > 12 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 12 * 0.04, type: "spring" }}
              className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border bg-surface text-sm font-medium text-muted-foreground"
            >
              +{total - 12}
            </motion.span>
          )}
        </div>
      </Reveal>
    </section>
  );
}
