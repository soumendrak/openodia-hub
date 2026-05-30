import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, GitPullRequest, CheckCircle2, Clock, Lightbulb } from "lucide-react";
import { Reveal } from "../components/Reveal";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap · OpenOdia" },
      {
        name: "description",
        content: "Public roadmap for OpenOdia — see what's planned, in progress, and completed.",
      },
      { property: "og:title", content: "Roadmap · OpenOdia" },
      {
        property: "og:description",
        content: "Public roadmap — see what's planned, in progress, and completed.",
      },
    ],
  }),
  component: RoadmapPage,
});

type RoadmapIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  created_at: string;
};

type RoadmapGroup = {
  status: string;
  label: string;
  issues: RoadmapIssue[];
};

type Resp = { groups: RoadmapGroup[]; fetchedAt: string };

const STATUS_CONFIG: Record<string, { icon: typeof Lightbulb; gradient: string; chip: string }> = {
  planned: {
    icon: Lightbulb,
    gradient: "from-saffron to-saffron/60",
    chip: "bg-saffron/10 text-saffron border-saffron/20",
  },
  "in-progress": {
    icon: Clock,
    gradient: "from-neon to-neon/60",
    chip: "bg-neon/10 text-neon border-neon/20",
  },
  completed: {
    icon: CheckCircle2,
    gradient: "from-emerald-400 to-emerald-400/60",
    chip: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  },
};

function getPriorityLabel(labels: { name: string; color: string }[]): {
  label: string;
  class: string;
} | null {
  const priority = labels.find((l) => l.name.startsWith("priority:"));
  if (!priority) return null;
  const level = priority.name.replace("priority:", "");
  const colors: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-saffron/10 text-saffron border-saffron/20",
    low: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20",
  };
  return { label: level, class: colors[level] ?? colors.medium };
}

function RoadmapPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["roadmap"],
    queryFn: async () => {
      const r = await fetch("/api/roadmap");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Resp;
    },
    staleTime: 10 * 60 * 1000,
  });

  const groups = data?.groups ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Roadmap</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          What's <span className="text-gradient">next</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          A transparent view of what the OpenOdia community is building. Issues are synced live from{" "}
          <a
            href="https://github.com/soumendrak/openodia-hub/issues"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            GitHub
          </a>
          . Want to help? Pick an item and jump in.
        </p>
      </Reveal>

      {isLoading ? (
        <div className="mt-16 space-y-10">
          {[0, 1, 2].map((s) => (
            <div key={s}>
              <div className="mb-4 h-8 w-32 animate-pulse rounded-lg bg-surface" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-16 space-y-16">
          {groups.map((group) => {
            const config = STATUS_CONFIG[group.status];
            const Icon = config.icon;

            return (
              <section key={group.status}>
                <Reveal>
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${config.gradient} text-primary-foreground`}
                    >
                      <Icon size={18} />
                    </div>
                    <h2 className="font-display text-3xl font-semibold md:text-4xl">
                      {group.label}
                    </h2>
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {group.issues.length}
                    </span>
                  </div>
                </Reveal>

                {group.issues.length === 0 ? (
                  <Reveal delay={0.05}>
                    <p className="mt-6 text-muted-foreground">
                      {group.status === "completed"
                        ? "Nothing shipped yet — the journey is just beginning."
                        : group.status === "in-progress"
                          ? "Nothing in progress right now. Want to pick something up?"
                          : "Nothing planned yet. Have an idea? Open an issue on GitHub."}
                    </p>
                  </Reveal>
                ) : (
                  <div className="mt-6 space-y-3">
                    {group.issues.map((issue, i) => {
                      const priority = getPriorityLabel(issue.labels);
                      return (
                        <Reveal key={issue.number} delay={i * 0.04}>
                          <motion.a
                            whileHover={{ x: 4 }}
                            transition={{ type: "spring", stiffness: 250, damping: 18 }}
                            href={issue.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/30"
                          >
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              #{issue.number}
                            </span>

                            <div className="min-w-0 flex-1">
                              <h3 className="font-display text-sm font-semibold leading-snug">
                                {issue.title}
                              </h3>
                            </div>

                            <div className="flex items-center gap-2">
                              {priority && (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${priority.class}`}
                                >
                                  {priority.label}
                                </span>
                              )}
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${config.chip}`}
                              >
                                {group.label}
                              </span>
                            </div>

                            <ExternalLink
                              size={14}
                              className="shrink-0 text-muted-foreground transition group-hover:text-neon"
                            />
                          </motion.a>
                        </Reveal>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {data && (
        <p className="mt-16 text-center text-xs text-muted-foreground">
          Synced {new Date(data.fetchedAt).toLocaleString()} · from{" "}
          <a
            href="https://github.com/soumendrak/openodia-hub/issues"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            GitHub Issues
          </a>
        </p>
      )}

      <Reveal
        delay={0.1}
        className="mt-16 rounded-3xl border border-border bg-surface p-8 text-center md:p-12"
      >
        <GitPullRequest size={28} className="mx-auto text-neon" />
        <h2 className="mt-4 font-display text-2xl font-semibold">Have an idea?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Open an issue on GitHub with your feature request, or pick up an existing item from the
          roadmap and start contributing.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href="https://github.com/soumendrak/openodia-hub/issues/new/choose"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Propose a feature
          </a>
          <a
            href="https://github.com/soumendrak/openodia-hub/issues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm"
          >
            Browse issues
          </a>
        </div>
      </Reveal>
    </div>
  );
}
