import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Reveal } from "../components/Reveal";
import { Marquee } from "../components/Marquee";
import { OdiaGlyph } from "../components/OdiaGlyph";
import { FEATURED_VIDEOS } from "../data/videos";
import { YoutubeIcon } from "../components/icons";
import { FaqSection, FAQS } from "../components/FaqSection";
import { ContributorGrid } from "../components/ContributorGrid";
import { ContributorLeaderboard } from "../components/ContributorLeaderboard";
import { JsonLd, faqPageSchema, breadcrumbSchema } from "../lib/jsonld";
import { usePattachitraMotion } from "../hooks/usePattachitraMotion";
import { COLLECTION, COMMUNITIES, ODIA_PHRASE } from "../lib/pattachitra";
import { withDeadline } from "../lib/fetch-utils";
import { pageHead } from "../lib/seo";
import { loadAwesome } from "../lib/sources/awesome";
import { loadRepos } from "../lib/sources/repos";
import { loadDatasets, loadModels } from "../lib/sources/huggingface";

/**
 * Ecosystem counts for the hero stats — the numbers the hub is actually about.
 * Every source is read through the shared cache, and a source that's down
 * simply drops out rather than showing a wrong number.
 */
const STATS_DEADLINE_MS = 6000;

/**
 * Ecosystem counts for the hero stats — the numbers the hub is actually about.
 *
 * Every source is read through the shared cache, so in steady state this is
 * free. On a cold cache each source gets a deadline and drops its tile rather
 * than holding the home page open behind a 150-repo fan-out; the directory
 * pages populate the same cache, so the tiles fill in.
 */
const getEcosystemStats = createServerFn({ method: "GET" }).handler(async () => {
  const none = { value: null as number | null, approx: false };
  const count = (items: unknown[] | null) => (items === null ? null : items.length);

  const [awesome, repos, models, datasets] = await Promise.all([
    withDeadline(loadAwesome(), STATS_DEADLINE_MS, null),
    withDeadline(loadRepos(), STATS_DEADLINE_MS, null),
    withDeadline(loadModels(), STATS_DEADLINE_MS, null),
    withDeadline(loadDatasets(), STATS_DEADLINE_MS, null),
  ]);

  const curated = count(awesome);
  const repoCount = count(repos);
  // "+" when the page cap stopped the fetch — the count is a floor, not a total.
  const page = (p: { items: unknown[]; truncated: boolean } | null) =>
    p === null ? none : { value: p.items.length, approx: p.truncated };

  return {
    projects: curated === null && repoCount === null ? null : (curated ?? 0) + (repoCount ?? 0),
    models: page(models),
    datasets: page(datasets),
  };
});

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      path: "",
      title: "OpenOdia — Open source for the Odia language",
      description:
        "The hub for open-source Odia: a directory of tools and libraries, a live registry of Odia models and datasets, and the community teaching and building with them.",
      ogDescription:
        "Open-source repos, tools, datasets, models, libraries, fonts, and resources for the Odia language.",
    }),
  loader: () => getEcosystemStats(),
  staleTime: 60 * 60 * 1000,
  component: Home,
});

function Home() {
  const pattaClass = usePattachitraMotion();

  return (
    <>
      {/* The painted composition. Everything inside .patta is laid out by
          src/styles/pattachitra.css; the live data sections below it follow
          the site's ordinary token styling, which is now the same palette. */}
      <div className={pattaClass}>
        <Hero />
        <div className="painted-divider" aria-hidden="true" />
        <Opening />
        <Collection />
        <Communities />
        <LearningBanner />
        <div className="painted-divider" aria-hidden="true" />
      </div>

      <Stats />
      <CommunityVideos />
      <ContributorGrid />
      <ContributorLeaderboard limit={5} />
      <FaqSection />
      <JsonLd data={faqPageSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", url: "https://openodia.com" }])} />
      <Marquee
        items={[
          "OpenOdia",
          "Fonts",
          "Datasets",
          "Models",
          "Transliteration",
          "Libraries",
          "Tools",
          "Open Source",
        ]}
      />
    </>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="rosette" aria-hidden="true">
            ✳
          </span>{" "}
          From Odisha. For every possibility.
        </p>
        <p className="odia-intro" lang="or">
          {ODIA_PHRASE}
        </p>
        <h1>
          Our language.
          <br />
          Our inheritance.
          <br />
          <em>Our next chapter.</em>
        </h1>
        <div className="tiny-rule" aria-hidden="true">
          <span />✦<span />
        </div>
        <p className="hero-description">
          A language carries a world within it. Discover the people, open tools, and ideas helping
          Odia flourish in the digital age.
        </p>
        <div className="hero-actions">
          <Link to="/tools" className="button gold-button">
            Explore the collection <span aria-hidden="true">↗</span>
          </Link>
          <Link to="/tutorials" className="quiet-link">
            Begin learning <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="hero-note">Our roots run deep. Our possibilities stay open.</p>
      </div>

      <div className="hero-art">
        <div className="painted-panel">
          <img
            className="pattachitra-frame"
            src="/pattachitra/ceremonial-frame.webp"
            alt="Pattachitra-inspired painted frame with floral borders, peacocks, and a Jagannath-inspired medallion"
            width={1122}
            height={1402}
            fetchPriority="high"
          />
          <div className="ambient-light" aria-hidden="true" />
          {/* The panel never moves. Only the letter turns, inside a stage that
              reserves clear space above the peacocks and lower ornament. */}
          <div className="letter-stage">
            <div id="letter-mount">
              <OdiaGlyph />
            </div>
          </div>
        </div>
        <span className="art-index">The living letter / ଓ</span>
      </div>
    </section>
  );
}

function Opening() {
  return (
    <section className="opening">
      <p className="eyebrow">A shared language. A shared responsibility.</p>
      <h2>
        What we inherit,
        <br />
        <em>we carry forward.</em>
      </h2>
      <p>
        From the words we grew up with to the things we have yet to build. OpenOdia is a guide to
        the resources and communities making new possibilities in our language.
      </p>
    </section>
  );
}

function Collection() {
  return (
    <section className="collection section-wrap" id="collection">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / The open collection</p>
          <h2>
            Old roots.
            <br />
            <em>New possibilities.</em>
          </h2>
        </div>
        <p>Find a starting point. Make it your own.</p>
      </div>

      <div className="collection-grid">
        {COLLECTION.map((c) => (
          <Link key={c.to} to={c.to} className="collection-item">
            <div
              className="collection-emblem"
              lang={c.emblemLang}
              aria-hidden={c.emblemLang ? undefined : "true"}
            >
              {c.emblem}
            </div>
            <span className="eyebrow">{c.eyebrow}</span>
            <h3>
              {c.title[0]}
              <br />
              {c.title[1]}
            </h3>
            <p>{c.body}</p>
            <span className="item-link">
              {c.cta} <b aria-hidden="true">↗</b>
            </span>
          </Link>
        ))}
      </div>

      <div className="playground-link">
        <span>Curiosity is a good place to begin.</span>
        <Link to="/playground">
          Try the playground <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function Communities() {
  return (
    <section className="community-section section-wrap" id="communities">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / The people who carry it forward</p>
          <h2>
            A language lives
            <br />
            <em>through its people.</em>
          </h2>
        </div>
        <p>Meet the communities already learning, researching, and building together.</p>
      </div>

      <div className="community-grid">
        {COMMUNITIES.map((c, i) => (
          <article key={c.href} className="community-card">
            <span className="card-no">{String(i + 1).padStart(2, "0")} / Community</span>
            <h3>
              {c.name[0]}
              {c.name[1] ? (
                <>
                  {/* The space is deliberate and separate from the break: the
                      break is hidden below 760px, and without this the two
                      halves collide into "GDG CloudBhubaneswar". */}
                  <br /> {c.name[1]}
                </>
              ) : null}
            </h3>
            <p>{c.body}</p>
            <a href={c.href} target="_blank" rel="noreferrer">
              {c.cta} <span aria-hidden="true">↗</span>
            </a>
          </article>
        ))}
      </div>

      <p className="community-note">
        Discover independent communities through OpenOdia. Each is run by its own organisers — visit
        their channels to join in.
      </p>
    </section>
  );
}

function LearningBanner() {
  return (
    <section className="learning-banner">
      <div className="learning-ornament" aria-hidden="true">
        ✺
      </div>
      <div>
        <p className="eyebrow">03 / Pass the knowledge on</p>
        <h2>
          Every shared idea
          <br />
          <em>becomes a new beginning.</em>
        </h2>
        <p>Talks, tutorials, and conversations from the people building around us.</p>
      </div>
      <Link to="/tutorials" className="button gold-button">
        Learn with the community <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}

function Stats() {
  const { projects, models, datasets } = Route.useLoaderData();

  // Counts come from the same sources the directories render, so the hero can't
  // contradict the pages it links to. A source that's down drops its tile
  // rather than showing a stale claim.
  const tiles = [
    { label: "Projects listed", value: projects, approx: false, href: "/tools" },
    { label: "Odia models", value: models.value, approx: models.approx, href: "/models" },
    { label: "Odia datasets", value: datasets.value, approx: datasets.approx, href: "/datasets" },
    { label: "Community channels", value: 5, approx: false, href: "/tutorials" },
  ] as const;
  // ponytail: "Community channels" is a hardcoded tile, so `shown` can never
  // be empty — no empty-state branch needed here.
  const shown = tiles.filter((t) => t.value !== null);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {shown.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05} className="bg-surface">
            <Link to={s.href} className="block p-8 transition hover:bg-surface-2">
              <div className="font-display text-4xl font-bold text-gradient md:text-5xl">
                {s.value}
                {s.approx ? "+" : ""}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

type CommunityVideo = { id: string; title: string; channelName: string; published?: string };

/**
 * The rail draws from every community channel the tutorials page aggregates,
 * not just one. The static list is the fallback while the feed loads or if it
 * is unreachable.
 */
function CommunityVideos() {
  const { data } = useQuery({
    queryKey: ["home", "community-videos"],
    queryFn: async () => {
      const r = await fetch("/api/videos");
      if (!r.ok) throw new Error("videos");
      return (await r.json()) as {
        channels: { name: string; videos: { id: string; title: string; published: string }[] }[];
      };
    },
    staleTime: 60 * 60 * 1000,
    // The adapter behind /api/videos already retries each feed and runs the
    // whole fan-out under a budget, so a 503 means it has exhausted its own
    // policy. React Query's default three retries would turn one outage into
    // four expensive upstream runs; the static rail below is the fallback.
    retry: false,
  });

  const live: CommunityVideo[] = (data?.channels ?? [])
    .flatMap((c) => c.videos.map((v) => ({ ...v, channelName: c.name })))
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
    .slice(0, 3);

  const videos: CommunityVideo[] =
    live.length === 3
      ? live
      : FEATURED_VIDEOS.map((v) => ({ id: v.id, title: v.title, channelName: "OpenOdia" }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold md:text-5xl">From the community</h2>
          <p className="mt-2 text-muted-foreground">
            Latest from the Odia AI channels — OdiaGenAI, OpenOdia, Odias in ML, TFUG Bhubaneswar,
            GDG Cloud Bhubaneswar.
          </p>
        </div>
        <Link to="/tutorials" className="hidden text-sm text-neon hover:underline md:inline">
          All tutorials →
        </Link>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {videos.map((v, i) => (
          <Reveal key={v.id} delay={i * 0.06}>
            <a
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                  alt={v.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-neon to-magenta text-primary-foreground">
                    <YoutubeIcon size={22} />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium leading-tight">{v.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{v.channelName}</p>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
