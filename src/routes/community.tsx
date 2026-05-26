import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, MessageCircle, Plus, Users } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { GithubIcon } from "../components/icons";

type Discussion = {
  number: number;
  title: string;
  url: string;
  category: string;
  emoji: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
};

type Category = {
  name: string;
  emoji: string;
  description: string;
  discussions: Discussion[];
};

type Resp = {
  categories: Category[];
  totalDiscussions: number;
  discussionsUrl: string;
  fetchedAt: string;
};

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community · OpenOdia" },
      {
        name: "description",
        content:
          "Join the OpenOdia community — discussions, help, showcases, and ideas for Odia open source.",
      },
      { property: "og:title", content: "Community · OpenOdia" },
      {
        property: "og:description",
        content: "OpenOdia community discussions — help, showcase, and ideas.",
      },
    ],
  }),
  component: CommunityPage,
});

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function CommunityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["community"],
    queryFn: async () => {
      const r = await fetch("/api/community");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Resp;
    },
    staleTime: 5 * 60 * 1000,
  });

  const categories = data?.categories ?? [];
  const total = data?.totalDiscussions ?? 0;
  const discussionsUrl =
    data?.discussionsUrl ?? "https://github.com/soumendrak/openodia-hub/discussions";
  const isEmpty = !isLoading && total === 0;
  const categoriesWithPosts = categories.filter((c) => c.discussions.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Community</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          Join the <span className="text-gradient">conversation</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Ask questions, showcase what you've built, share ideas, and connect with others working on
          Odia open source. Discussions live on GitHub — sign in there to participate.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`${discussionsUrl}/new/choose`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} /> Start a discussion
          </a>
          <a
            href={discussionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-neon hover:text-neon"
          >
            <GithubIcon size={16} /> View all on GitHub
          </a>
        </div>
      </Reveal>

      {isLoading && (
        <div className="mt-12 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      )}

      {isEmpty && (
        <Reveal delay={0.1} className="mt-16">
          <div className="rounded-3xl border border-border bg-surface p-10 text-center">
            <Users size={32} className="mx-auto text-muted-foreground" />
            <h2 className="mt-4 font-display text-2xl font-semibold">No discussions yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Be the first to start a conversation. Ask a question, share a project, or pitch an
              idea.
            </p>
            <a
              href={`${discussionsUrl}/new/choose`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Plus size={16} /> Start the first discussion
            </a>
          </div>
        </Reveal>
      )}

      {!isLoading && categoriesWithPosts.length > 0 && (
        <div className="mt-12 space-y-12">
          {categoriesWithPosts.map((cat, i) => (
            <Reveal key={cat.name} delay={i * 0.05}>
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-semibold">
                    <span className="mr-2" aria-hidden>
                      {cat.emoji}
                    </span>
                    {cat.name}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {cat.discussions.length}{" "}
                    {cat.discussions.length === 1 ? "discussion" : "discussions"}
                  </span>
                </div>
                {cat.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                )}
                <div className="mt-4 space-y-2">
                  {cat.discussions.map((d) => (
                    <motion.a
                      key={d.number}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-neon/40"
                    >
                      <img
                        src={d.authorAvatar}
                        alt={d.author}
                        loading="lazy"
                        className="h-9 w-9 shrink-0 rounded-full border border-border"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium">{d.title}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          @{d.author} · updated {timeAgo(d.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle size={12} />
                        {d.replyCount}
                      </div>
                      <ExternalLink
                        size={14}
                        className="shrink-0 text-muted-foreground transition group-hover:text-neon"
                      />
                    </motion.a>
                  ))}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
