import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Play, ExternalLink, ListVideo, Search, X } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import { YoutubeIcon } from "../components/icons";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title: "Tutorials · OpenOdia" },
      {
        name: "description",
        content:
          "Video tutorials from the OpenOdia community — learn Odia language technology, open-source tools, font development, NLP, and more.",
      },
      { property: "og:title", content: "Tutorials · OpenOdia" },
      {
        property: "og:description",
        content:
          "OpenOdia tutorials covering Odia language tech, open-source tools, fonts, and community projects.",
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

type Playlist = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
};

type ChannelResult = {
  handle: string;
  name: string;
  url: string;
  videos: Video[];
  playlists: Playlist[];
};

function TutorialsPage() {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useSearchShortcut(searchInputRef);

  const { data, isLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const r = await fetch("/api/videos");
      if (!r.ok) throw new Error("videos");
      return r.json() as Promise<{ channels: ChannelResult[] }>;
    },
  });

  const channels = data?.channels ?? [];
  const needle = query.trim().toLowerCase();

  const filteredVideos = needle
    ? channels.flatMap((c) =>
        c.videos.filter(
          (v) =>
            v.title.toLowerCase().includes(needle) ||
            v.channelName.toLowerCase().includes(needle) ||
            v.channelHandle.toLowerCase().includes(needle),
        ),
      )
    : [];

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

      <div className="mt-10">
        <Reveal>
          <div className="relative max-w-xl">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search videos, channels… [/]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {needle ? (
        <section className="mt-10">
          <Reveal>
            <p className="text-sm text-muted-foreground">
              {filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""} for &ldquo;
              {needle}&rdquo;
            </p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredVideos.length === 0 ? (
              <p className="col-span-full text-muted-foreground">No videos matched.</p>
            ) : (
              filteredVideos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
            )}
          </div>
        </section>
      ) : isLoading ? (
        <ChannelSkeleton />
      ) : (
        channels.map((channel) => <ChannelSection key={channel.handle} channel={channel} />)
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

function PlaylistCard({ playlist, index }: { playlist: Playlist; index: number }) {
  return (
    <Reveal delay={(index % 4) * 0.05}>
      <motion.a
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        href={`https://www.youtube.com/playlist?list=${playlist.id}`}
        target="_blank"
        rel="noreferrer"
        className="group flex gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-neon/40"
      >
        <div
          className="relative shrink-0 overflow-hidden rounded-lg"
          style={{ width: 100, height: 56 }}
        >
          {playlist.thumbnail ? (
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2">
              <ListVideo size={18} className="text-muted-foreground" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
            <ListVideo size={9} />
            <span>{playlist.itemCount}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-snug">{playlist.title}</p>
          {playlist.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
              {playlist.description}
            </p>
          )}
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

      {channel.playlists.length > 0 && (
        <div className="mt-6">
          <Reveal>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <ListVideo size={13} /> Playlists
            </p>
          </Reveal>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {channel.playlists.map((p, i) => (
              <PlaylistCard key={p.id} playlist={p} index={i} />
            ))}
          </div>
        </div>
      )}
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
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface"
              >
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
