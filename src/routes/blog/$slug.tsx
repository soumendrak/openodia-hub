import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { marked } from "marked";
import { ArrowLeft } from "lucide-react";
import { Reveal } from "../../components/Reveal";

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

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

export const Route = createFileRoute("/blog/$slug")({
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.post?.title ?? "Blog"} · OpenOdia` },
      { name: "description", content: loaderData?.post?.excerpt ?? "" },
    ],
  }),
  loader: async ({ params }) => {
    const modules = import.meta.glob<string>("/src/content/blog/*.md", {
      query: "?raw",
      import: "default",
      eager: true,
    });

    const key = Object.keys(modules).find((k) => k.endsWith(`${params.slug}.md`));
    if (!key) throw new Error("Post not found");

    const raw = modules[key];
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = match ? parseYamlLike(match[1]) : {};
    const body = stripFrontmatter(raw);
    const html = await marked(body);

    return {
      post: {
        title: (fm.title as string) ?? "",
        date: (fm.date as string) ?? "",
        author: (fm.author as string) ?? "@openodia",
        tags: (fm.tags as string[]) ?? [],
        excerpt: (fm.excerpt as string) ?? "",
        source_url: (fm.source_url as string) ?? undefined,
      },
      html,
    };
  },
  component: BlogPost,
});

function BlogPost() {
  const { post, html } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <Reveal>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-neon transition"
        >
          <ArrowLeft size={14} /> Back to blog
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <p className="mt-8 text-sm uppercase tracking-widest text-neon">Blog</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-5xl">
          {post.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span aria-hidden>·</span>
          <span>{post.author}</span>
        </div>
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
      </Reveal>

      <Reveal delay={0.1}>
        <article
          className="prose prose-invert mt-10 max-w-none
            prose-headings:font-display prose-headings:text-foreground
            prose-h2:mt-10 prose-h2:text-2xl prose-h2:font-semibold
            prose-h3:mt-8 prose-h3:text-xl prose-h3:font-semibold
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-neon prose-a:no-underline hover:prose-a:underline
            prose-code:rounded prose-code:border prose-code:border-border prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
            prose-pre:rounded-2xl prose-pre:border prose-pre:border-border prose-pre:bg-surface
            prose-li:text-muted-foreground
            prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {post.source_url && (
          <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm text-muted-foreground">
              Source:{" "}
              <a
                href={post.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-neon hover:underline"
              >
                {post.source_url}
              </a>
            </p>
          </div>
        )}
      </Reveal>
    </div>
  );
}
