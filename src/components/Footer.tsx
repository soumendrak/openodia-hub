import { Link } from "@tanstack/react-router";
import { Heart, Rss } from "lucide-react";
import { GithubIcon, YoutubeIcon } from "./icons";

export function Footer() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-magenta text-primary-foreground font-display text-xl font-bold">
                ଓ
              </span>
              <span className="font-display text-lg font-semibold">OpenOdia</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Open source initiatives for the Odia language — community-driven.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/tools" className="hover:text-foreground">
                  Tools & projects
                </Link>
              </li>
              <li>
                <Link to="/models" className="hover:text-foreground">
                  Models
                </Link>
              </li>
              <li>
                <Link to="/datasets" className="hover:text-foreground">
                  Datasets
                </Link>
              </li>
              <li>
                <Link to="/tutorials" className="hover:text-foreground">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link to="/playground" className="hover:text-foreground">
                  Playground
                </Link>
              </li>
              <li>
                <Link
                  to="/playground"
                  search={{ tab: "translit" }}
                  className="hover:text-foreground"
                >
                  Transliteration
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <Link to="/events" className="hover:text-foreground">
                  Events
                </Link>
                <a
                  href="/events-feed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-400 transition"
                  title="Subscribe to RSS Feed of Events"
                >
                  <Rss size={13} />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Research</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/papers" className="hover:text-foreground">
                  Papers
                </Link>
              </li>
              <li>
                <Link to="/treebank" className="hover:text-foreground">
                  Treebank search
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Develop</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/api" className="hover:text-foreground">
                  API
                </Link>
              </li>
              <li>
                <Link to="/contribute" className="hover:text-foreground">
                  Add your project
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-foreground">
                  About
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Connect</h4>
            <div className="mt-3 flex gap-3">
              <a
                href="https://github.com/soumendrak/openodia-hub"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border p-2 transition hover:border-neon hover:text-neon"
                aria-label="GitHub"
              >
                <GithubIcon />
              </a>
              <a
                href="https://www.youtube.com/@openodia"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border p-2 transition hover:border-magenta hover:text-magenta"
                aria-label="YouTube"
              >
                <YoutubeIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <p>
            © {new Date().getFullYear()} OpenOdia · Built with{" "}
            <Heart size={12} className="inline text-magenta" aria-hidden="true" />
            <span className="sr-only">love</span> in Odisha
          </p>
          <p>ଓଡ଼ିଆ ଭାଷା ପାଇଁ ଓପନ୍ ସୋର୍ସ</p>
        </div>
      </div>
    </footer>
  );
}
