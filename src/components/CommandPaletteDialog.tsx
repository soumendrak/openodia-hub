import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar, FileText, Play, Wrench } from "lucide-react";
import { GithubIcon } from "./icons";

type Repo = {
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
};

type Tool = {
  name: string;
  url: string;
  description: string;
  category: string;
};

type ChannelVideo = {
  id: string;
  title: string;
  channelName: string;
};

type Channel = {
  name: string;
  videos: ChannelVideo[];
};

type EventItem = {
  title: string;
  url: string;
  description: string;
  community: string;
};

const PAGES: { label: string; path: string }[] = [
  { label: "Home", path: "/" },
  { label: "Tools", path: "/tools" },
  { label: "Models", path: "/models" },
  { label: "Datasets", path: "/datasets" },
  { label: "Tutorials", path: "/tutorials" },
  { label: "Playground", path: "/playground" },
  { label: "Events", path: "/events" },
  { label: "Papers", path: "/papers" },
  { label: "Treebank search", path: "/treebank" },
  { label: "Add your project", path: "/contribute" },
  { label: "API", path: "/api" },
  { label: "About", path: "/about" },
];

const MAX_PER_GROUP = 30;

/**
 * The palette's actual UI. Split out from the launcher so `cmdk`, the Radix
 * dialog, and the four fetchers stay out of the entry bundle until someone
 * presses ⌘K — see CommandPalette.tsx.
 */
export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const { data: reposData } = useQuery({
    queryKey: ["palette", "repos"],
    queryFn: async () => {
      const r = await fetch("/api/repos");
      if (!r.ok) throw new Error("repos");
      return (await r.json()) as { repos: Repo[] };
    },
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });

  const { data: toolsData } = useQuery({
    queryKey: ["palette", "tools"],
    queryFn: async () => {
      const r = await fetch("/api/awesome");
      if (!r.ok) throw new Error("tools");
      return (await r.json()) as { items: Tool[] };
    },
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });

  const { data: videosData } = useQuery({
    queryKey: ["palette", "videos"],
    queryFn: async () => {
      const r = await fetch("/api/videos");
      if (!r.ok) throw new Error("videos");
      return (await r.json()) as { channels: Channel[] };
    },
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });

  const { data: eventsData } = useQuery({
    queryKey: ["palette", "events"],
    queryFn: async () => {
      const r = await fetch("/api/events");
      if (!r.ok) throw new Error("events");
      return (await r.json()) as { events: EventItem[] };
    },
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });

  const repos = (reposData?.repos ?? []).slice(0, MAX_PER_GROUP);
  const tools = (toolsData?.items ?? []).slice(0, MAX_PER_GROUP);
  const videos = (videosData?.channels ?? [])
    .flatMap((c) => c.videos.map((v) => ({ ...v, channelName: v.channelName ?? c.name })))
    .slice(0, MAX_PER_GROUP);
  const events = (eventsData?.events ?? []).slice(0, MAX_PER_GROUP);

  const close = () => onOpenChange(false);
  const goInternal = (path: string) => {
    close();
    navigate({ to: path });
  };
  const goExternal = (url: string) => {
    close();
    if (typeof window !== "undefined") window.open(url, "_blank", "noreferrer");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search repos, tools, tutorials, events…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.path} value={`page ${p.label}`} onSelect={() => goInternal(p.path)}>
              <FileText />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {repos.length > 0 && (
          <CommandGroup heading="Repositories">
            {repos.map((r) => (
              <CommandItem
                key={r.full_name}
                value={`repo ${r.full_name} ${r.description ?? ""} ${r.language ?? ""} ${(r.topics ?? []).join(" ")}`}
                onSelect={() => goExternal(r.html_url)}
              >
                <GithubIcon />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{r.full_name}</span>
                  {r.description && (
                    <span className="truncate text-xs text-muted-foreground">{r.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {tools.length > 0 && (
          <CommandGroup heading="Tools & datasets">
            {/* The Awesome list reuses the same paper URL across entries, so the
                index is part of the key — same reasoning as tools.tsx. */}
            {tools.map((t, idx) => (
              <CommandItem
                key={`${idx}:${t.url}`}
                value={`tool ${t.name} ${t.description} ${t.category}`}
                onSelect={() => goExternal(t.url)}
              >
                <Wrench />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{t.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.category}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {videos.length > 0 && (
          <CommandGroup heading="Tutorials">
            {videos.map((v) => (
              <CommandItem
                key={v.id}
                value={`video ${v.title} ${v.channelName}`}
                onSelect={() => goExternal(`https://www.youtube.com/watch?v=${v.id}`)}
              >
                <Play />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{v.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{v.channelName}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {events.length > 0 && (
          <CommandGroup heading="Events">
            {events.map((e) => (
              <CommandItem
                key={e.url}
                value={`event ${e.title} ${e.description} ${e.community}`}
                onSelect={() => goExternal(e.url)}
              >
                <Calendar />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{e.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{e.community}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
