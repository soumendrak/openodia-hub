import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "../../lib/fetch-utils";

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

type ApiResp = {
  categories: Category[];
  totalDiscussions: number;
  discussionsUrl: string;
  fetchedAt: string;
};

const REPO_OWNER = "soumendrak";
const REPO_NAME = "openodia-hub";
const DISCUSSIONS_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/discussions`;

const QUERY = `
{
  repository(owner: "${REPO_OWNER}", name: "${REPO_NAME}") {
    discussionCategories(first: 20) {
      nodes { name emoji description }
    }
    discussions(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        number
        title
        url
        createdAt
        updatedAt
        category { name emoji }
        author { login avatarUrl }
        comments(first: 1) { totalCount }
      }
    }
  }
}`;

type GraphqlDiscussion = {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  category: { name: string; emoji: string };
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number };
};

type GraphqlResp = {
  data?: {
    repository?: {
      discussionCategories?: {
        nodes: { name: string; emoji: string; description: string }[];
      };
      discussions?: {
        totalCount: number;
        nodes: GraphqlDiscussion[];
      };
    };
  };
};

// GitHub returns category emoji as a shortcode (":speech_balloon:"). Browsers
// don't render shortcodes natively, so map the defaults to Unicode glyphs.
// Custom categories fall through to the trimmed shortcode text.
const EMOJI_MAP: Record<string, string> = {
  mega: "📣",
  speech_balloon: "💬",
  bulb: "💡",
  ballot_box: "🗳️",
  pray: "🙏",
  raised_hands: "🙌",
  rocket: "🚀",
  tada: "🎉",
  star: "⭐",
  question: "❓",
  thinking: "🤔",
  hammer_and_wrench: "🛠️",
  hammer: "🔨",
  calendar: "📅",
  newspaper: "📰",
  warning: "⚠️",
  heart: "❤️",
  art: "🎨",
};

function emojiFromShortcode(s: string): string {
  const key = s.replace(/^:|:$/g, "");
  return EMOJI_MAP[key] ?? key;
}

export const Route = createFileRoute("/api/community")({
  server: {
    handlers: {
      GET: async () => {
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          // GraphQL discussions API requires authentication. Without a token,
          // return an empty payload rather than a 5xx so the page can render
          // its empty/CTA state.
          return buildResponse(emptyResp(), 200);
        }

        try {
          const r = await fetchWithTimeout("https://api.github.com/graphql", {
            method: "POST",
            headers: {
              "User-Agent": "openodia.com",
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: QUERY }),
          });
          if (!r.ok) return buildResponse(emptyResp(), 200);

          const data = (await r.json()) as GraphqlResp;
          const repo = data.data?.repository;
          if (!repo) return buildResponse(emptyResp(), 200);

          const categories = repo.discussionCategories?.nodes ?? [];
          const discussions = repo.discussions?.nodes ?? [];

          const byCategory = new Map<string, Discussion[]>();
          for (const d of discussions) {
            const items = byCategory.get(d.category.name) ?? [];
            items.push({
              number: d.number,
              title: d.title,
              url: d.url,
              category: d.category.name,
              emoji: emojiFromShortcode(d.category.emoji),
              author: d.author?.login ?? "ghost",
              authorAvatar: d.author?.avatarUrl ?? "https://github.com/identicons/ghost.png",
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
              replyCount: d.comments.totalCount,
            });
            byCategory.set(d.category.name, items);
          }

          const out: Category[] = categories.map((c) => ({
            name: c.name,
            emoji: emojiFromShortcode(c.emoji),
            description: c.description,
            discussions: byCategory.get(c.name) ?? [],
          }));

          return buildResponse(
            {
              categories: out,
              totalDiscussions: repo.discussions?.totalCount ?? 0,
              discussionsUrl: DISCUSSIONS_URL,
              fetchedAt: new Date().toISOString(),
            },
            200,
          );
        } catch (e) {
          console.error("community error", e);
          return buildResponse(emptyResp(), 200);
        }
      },
    },
  },
});

function emptyResp(): ApiResp {
  return {
    categories: [],
    totalDiscussions: 0,
    discussionsUrl: DISCUSSIONS_URL,
    fetchedAt: new Date().toISOString(),
  };
}

function buildResponse(body: ApiResp, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, User-Agent",
    },
  });
}
