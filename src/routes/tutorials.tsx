import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Play, ExternalLink } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { YoutubeIcon } from "../components/icons";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title: "Tutorials · OpenOdia" },
      {
        name: "description",
        content:
          "Video tutorials from OdiaGenAI, Odias in ML, and OpenOdia — learn Odia NLP, AI, and language technology.",
      },
      { property: "og:title", content: "Tutorials · OpenOdia" },
      {
        property: "og:description",
        content: "Video tutorials from the Odia AI community channels.",
      },
    ],
  }),
  component: TutorialsPage,
});

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  viewCount?: number;
};

type ChannelResult = {
  handle: string;
  name: string;
  url: string;
  videos: Video[];
};

function TutorialsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const r = await fetch("/api/videos");
      if (!r.ok) throw new Error("videos");
      return r.json() as Promise<{ channels: ChannelResult[] }>;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Learn</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">Tutorials</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Videos from the Odia AI community — covering NLP, language models, and Odia language
          technology. Sourced from{" "}
          <a
            href="https://www.youtube.com/@OdiaGenAI"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            OdiaGenAI
          </a>
          ,{" "}
          <a
            href="https://www.youtube.com/@OdiasInML"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            Odias in ML
          </a>
          , and{" "}
          <a
            href="https://www.youtube.com/@openodia"
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            OpenOdia
          </a>
          .
        </p>
      </Reveal>

      {isLoading ? (
        <ChannelSkeleton />
      ) : (
        data?.channels.map((channel) => (
          <ChannelSection key={channel.handle} channel={channel} />
        ))
      )}
    </div>
  );
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

function VideoCard({ video, index }: { video: Video; index: number }) {
  const date = new Date(video.published).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  return (
    <Reveal delay={(index % 4) * 0.05}>
      <motion.a
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-neon/40"
      >
        <div className="relative aspect-video overflow-hidden bg-surface-2">
          <img
            src={video.thumbnail}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-neon/90">
              <Play size={20} fill="currentColor" className="ml-0.5 text-background" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{date}</span>
            {video.viewCount !== undefined && video.viewCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{formatViews(video.viewCount)}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug">
            {video.title}
          </h3>
        </div>
      </motion.a>
    </Reveal>
  );
}

function ChannelSection({ channel }: { channel: ChannelResult }) {
  if (channel.videos.length === 0) return null;

  return (
    <section className="mt-20">
      <Reveal>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <YoutubeIcon size={22} className="text-neon" />
            <h2 className="font-display text-3xl font-semibold md:text-4xl">{channel.name}</h2>
          </div>
          <a
            href={channel.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition hover:border-neon hover:text-neon"
          >
            View channel <ExternalLink size={11} />
          </a>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Latest from{" "}
          <a
            href={channel.url}
            target="_blank"
            rel="noreferrer"
            className="text-neon hover:underline"
          >
            @{channel.handle}
          </a>
        </p>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {channel.videos.map((v, i) => (
          <VideoCard key={v.id} video={v} index={i} />
        ))}
      </div>
    </section>
  );
}

function ChannelSkeleton() {
  return (
    <>
      {[0, 1, 2].map((s) => (
        <section key={s} className="mt-20">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-surface" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="aspect-video bg-surface-2" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-16 rounded bg-surface-2" />
                  <div className="h-4 w-full rounded bg-surface-2" />
                  <div className="h-4 w-3/4 rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
