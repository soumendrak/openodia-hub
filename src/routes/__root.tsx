import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { ScrollToTop } from "../components/ScrollToTop";
import { CommandPalette } from "../components/CommandPalette";
import { I18nProvider } from "../lib/i18n";
import { JsonLd, siteOrganization, authorPerson, webSiteSchema } from "../lib/jsonld";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-neon to-magenta px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-gradient-to-r from-neon to-magenta px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border px-5 py-2.5 text-sm">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OpenOdia — Open source for the Odia language" },
      {
        name: "description",
        content: "Open source projects, tools, and AI resources for the Odia language.",
      },
      { name: "author", content: "OpenOdia" },
      { property: "og:title", content: "OpenOdia — Open source for the Odia language" },
      {
        property: "og:description",
        content: "Open source projects, tools, and AI resources for the Odia language.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openodia.com" },
      // PNG, not the source SVG: Facebook, X, and LinkedIn all drop SVG
      // previews. Regenerate with `bun scripts/build-og-image.mjs`.
      { property: "og:image", content: "https://openodia.com/openodia-og.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "OpenOdia — open source for the Odia language" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@openodia" },
      { name: "twitter:image", content: "https://openodia.com/openodia-og.png" },
      { name: "theme-color", content: "#0a0a14" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Eight font files trimmed to four. Space Grotesk only ever sets
      // headings (500/600/700 — never 400), and JetBrains Mono was a whole
      // extra family for a handful of facet counts and the ⌘K hint, which
      // the system mono stack renders just as well. See --font-mono.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script below sets `class` and `lang` on <html> before
    // React hydrates, so the server markup deliberately doesn't match.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <JsonLd data={siteOrganization()} />
        <JsonLd data={authorPerson()} />
        <JsonLd data={webSiteSchema()} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'light' || (!theme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.remove('light');
                }
                var locale = localStorage.getItem('locale');
                if (locale === 'en' || locale === 'or') {
                  document.documentElement.lang = locale;
                }
              } catch (_) {}
            `,
          }}
        />
        <script src="https://rybbit.ekathi.com/api/script.js" data-site-id="9dad6ada855b" defer />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ScrollToTop />
        <Nav />
        <CommandPalette />
        <main className="pt-24">
          <Outlet />
        </main>
        <Footer />
      </I18nProvider>
    </QueryClientProvider>
  );
}
