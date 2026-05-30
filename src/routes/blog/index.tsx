import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Reveal } from "../../components/Reveal";

type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
};

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog · OpenOdia" },
      {
        name: "description",
        content:
          "Stories from the Odia open-source AI community — milestones, releases, and the journey of making Odia a first-class language in AI.",
      },
    ],
  }),
  loader: async () => {
    // Posts are imported as raw strings via Vite glob at the server level
    const modules = import.meta.glob<string>("/src/content/blog/*.md", {
      query: "?raw",
      import: "default",
      eager: true,
    });

    const posts: BlogPost[] = [];
    for (const [path, raw] of Object.entries(modules)) {
      const slug = path.split("/").pop()!.replace(".md", "");
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) continue;
      const fm = parseYamlLike(match[1]);
      posts.push({
        slug,
        title: fm.title ?? "",
        date: fm.date ?? "",
        author: fm.author ?? "@openodia",
        tags: fm.tags ?? [],
        excerpt: fm.excerpt ?? "",
      });
    }

    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { posts };
  },
  component: BlogIndex,
});

function parseYamlLike(raw: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/"/g, ""));
    }
    if (typeof value === "string") value = value.replace(/^"(.*)"$/, "$1");
    fm[key] = value;
  }
  return fm;
}

function groupByYear(posts: BlogPost[]): Map<number, BlogPost[]> {
  const map = new Map<number, BlogPost[]>();
  for (const post of posts) {
    const year = new Date(post.date).getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(post);
  }
  return map;
}

function BlogIndex() {
  const { posts } = Route.useLoaderData();
  const grouped = groupByYear(posts);
  const years = Array.from(grouped.keys()).sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <Reveal>
        <p className="text-sm uppercase tracking-widest text-neon">Blog</p>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-7xl">
          The Odia AI <span className="text-gradient">journey</span>.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Milestones, releases, and stories from the community building open-source AI for the Odia
          language — from 2019 to today.
        </p>
      </Reveal>

      <div className="mt-16">
        {years.map((year) => (
          <section key={year} className="relative pb-12">
            <div className="absolute left-0 top-0 h-full w-px bg-border" />
            <Reveal>
              <div className="sticky top-24 z-10 mb-6 flex items-center gap-3">
                <span className="relative -left-[5px] h-3 w-3 rounded-full bg-gradient-to-br from-neon to-magenta ring-4 ring-background" />
                <h2 className="font-display text-2xl font-bold text-gradient md:text-3xl">
                  {year}
                </h2>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {grouped.get(year)!.length} post
                  {grouped.get(year)!.length !== 1 ? "s" : ""}
                </span>
              </div>
            </Reveal>
            <div className="ml-6 space-y-5">
              {grouped.get(year)!.map((post, i) => (
                <Reveal key={post.slug} delay={i * 0.04}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group block rounded-2xl border border-border bg-surface p-5 transition hover:border-neon/30"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                      <span aria-hidden>·</span>
                      <span>{post.author}</span>
                    </div>
                    <h3 className="mt-2 font-display text-lg font-semibold leading-snug transition group-hover:text-neon">
                      {post.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                    {post.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
