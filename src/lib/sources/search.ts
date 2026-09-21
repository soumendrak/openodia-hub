import { events, type Event } from "../../data/events";
import { dedupeEventsByUrl } from "../event-url";
import { type SearchDocument, type SearchKind, type SearchSourceStatus } from "../search";
import { cachedJson } from "./cache";
import { loadCatalog } from "./catalog";
import { loadPapers } from "./papers";
import { loadVideos } from "./videos";
import { CHAPTERS, fetchChapterEvents } from "../../routes/api/events";

export type SearchSnapshot = {
  documents: SearchDocument[];
  sources: SearchSourceStatus[];
  builtAt: string;
};

export type SearchLoaders = {
  catalog: typeof loadCatalog;
  papers: typeof loadPapers;
  videos: typeof loadVideos;
  events: typeof loadLiveSearchEvents;
};

export const SEARCH_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

const PAGES: SearchDocument[] = [
  ["Home", "/", "OpenOdia home and ecosystem guide"],
  ["Tools", "/tools", "Odia open-source projects and repositories"],
  ["Models", "/models", "Odia language models"],
  ["Datasets", "/datasets", "Odia datasets and corpora"],
  ["Tutorials", "/tutorials", "Odia AI community videos and learning"],
  ["Playground", "/playground", "Try Odia language tools in the browser"],
  ["Events", "/events", "Odia AI community events"],
  ["Papers", "/papers", "Odia NLP research papers"],
  ["Treebank search", "/treebank", "Search the Odia Universal Dependencies treebank"],
  ["Add your project", "/contribute", "Contribute an Odia open-source project"],
  ["API", "/api", "OpenOdia public API reference"],
  ["About", "/about", "About the OpenOdia ecosystem"],
].map(([title, href, summary]) => ({
  id: `page:${href}`,
  kind: "page" as const,
  title,
  href,
  summary,
  keywords: [title, "odia", "oriya"],
  source: "pages",
}));

function catalogKind(kind: string): SearchKind {
  if (kind === "gh") return "repository";
  if (kind === "model" || kind === "dataset") return kind;
  return "tool";
}

function eventDocument(event: Event): SearchDocument {
  const href = `/events?q=${encodeURIComponent(event.title)}`;
  return {
    id: `event:${event.url}`,
    kind: "event",
    title: event.title,
    summary: event.description,
    keywords: [event.community, event.type, event.location ?? "", event.date, event.year],
    href,
    externalHref: event.url,
    source: "events",
  };
}

export async function loadLiveSearchEvents(
  fetcher: typeof fetchChapterEvents = fetchChapterEvents,
  chapters: typeof CHAPTERS = CHAPTERS,
): Promise<Event[]> {
  const settled = await Promise.allSettled(
    chapters.map((chapter) => fetcher(chapter.community, chapter.slug)),
  );
  return settled.flatMap((outcome) => (outcome.status === "fulfilled" ? outcome.value : []));
}

const DEFAULT_LOADERS: SearchLoaders = {
  catalog: loadCatalog,
  papers: loadPapers,
  videos: loadVideos,
  events: loadLiveSearchEvents,
};

/**
 * Builds an uncached snapshot. Loader injection keeps source mapping and
 * partial-failure behaviour testable without reaching live upstreams.
 */
export async function buildSearchSnapshot(
  loaders: SearchLoaders = DEFAULT_LOADERS,
): Promise<SearchSnapshot> {
  const [catalog, papers, channels, live] = await Promise.allSettled([
    loaders.catalog(),
    loaders.papers(),
    loaders.videos(),
    loaders.events(),
  ]);
  const sources: SearchSourceStatus[] = [
    {
      source: "pages",
      status: "ready",
      count: PAGES.length,
    },
  ];
  const documents: SearchDocument[] = [...PAGES];

  if (catalog.status === "fulfilled") {
    const records = catalog.value.map((entry) => ({
      id: `resource:${entry.key}`,
      kind: catalogKind(entry.kind),
      title: entry.name,
      summary: entry.description,
      keywords: [
        entry.author,
        entry.task,
        entry.category ?? "",
        entry.language ?? "",
        ...entry.tags,
      ],
      href: entry.permalink,
      externalHref: entry.url,
      source: "catalog",
    }));
    documents.push(...records);
    sources.push({ source: "catalog", status: "ready", count: records.length });
  } else sources.push({ source: "catalog", status: "unavailable", count: 0 });

  if (papers.status === "fulfilled") {
    const records = papers.value.map((paper) => ({
      id: `paper:${paper.id}`,
      kind: "paper" as const,
      title: paper.title,
      summary: paper.abstract,
      keywords: [...paper.authors, paper.venue, ...paper.tasks, "odia", "oriya"],
      href: `/papers?q=${encodeURIComponent(paper.title)}`,
      externalHref: paper.url,
      source: "papers",
    }));
    documents.push(...records);
    sources.push({ source: "papers", status: "ready", count: records.length });
  } else sources.push({ source: "papers", status: "unavailable", count: 0 });

  if (channels.status === "fulfilled") {
    const records = channels.value.flatMap((channel) =>
      channel.videos.map((video) => ({
        id: `video:${video.id}`,
        kind: "tutorial" as const,
        title: video.title,
        summary: `Tutorial from ${video.channelName}`,
        keywords: [video.channelName, video.channelHandle, "odia", "oriya"],
        href: `/tutorials?q=${encodeURIComponent(video.title)}`,
        externalHref: `https://www.youtube.com/watch?v=${video.id}`,
        source: "videos",
      })),
    );
    documents.push(...records);
    sources.push({ source: "videos", status: "ready", count: records.length });
  } else sources.push({ source: "videos", status: "unavailable", count: 0 });

  const known = [...events, ...(live.status === "fulfilled" ? live.value : [])];
  const eventRecords = dedupeEventsByUrl(known).map(eventDocument);
  documents.push(...eventRecords);
  sources.push({
    source: "events",
    status: live.status === "rejected" ? "unavailable" : "ready",
    count: eventRecords.length,
  });

  return { documents, sources, builtAt: new Date().toISOString() };
}

export function createSearchSnapshotLoader(
  loaders: SearchLoaders = DEFAULT_LOADERS,
  cacheKey = "search-snapshot:v1",
): () => Promise<SearchSnapshot> {
  return () => cachedJson(cacheKey, SEARCH_SNAPSHOT_TTL_MS, () => buildSearchSnapshot(loaders));
}

const loadDefaultSearchSnapshot = createSearchSnapshotLoader();

export const loadSearchSnapshot = loadDefaultSearchSnapshot;
