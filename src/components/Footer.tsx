import { Link } from "@tanstack/react-router";
import { Heart, Rss } from "lucide-react";
import { GithubIcon, YoutubeIcon } from "./icons";
import { T, useFallbackLang, useTranslation } from "../lib/i18n";
import { ODIA_PHRASE } from "../lib/pattachitra";

export function Footer() {
  const { t, locale } = useTranslation();
  const rssLang = useFallbackLang("footer.rss");
  return (
    <footer lang={locale} className="border-t border-border mt-32">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <span
                lang="or"
                className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-magenta text-primary-foreground text-xl font-semibold"
              >
                ଓ
              </span>
              <span className="font-display text-lg font-semibold">OpenOdia</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              <T k="footer.description" />
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">
              <T k="footer.explore" />
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/tools" className="hover:text-foreground">
                  <T k="footer.tools" />
                </Link>
              </li>
              <li>
                <Link to="/models" className="hover:text-foreground">
                  <T k="nav.models" />
                </Link>
              </li>
              <li>
                <Link to="/datasets" className="hover:text-foreground">
                  <T k="nav.datasets" />
                </Link>
              </li>
              <li>
                <Link to="/tutorials" className="hover:text-foreground">
                  <T k="nav.tutorials" />
                </Link>
              </li>
              <li>
                <Link to="/playground" className="hover:text-foreground">
                  <T k="nav.playground" />
                </Link>
              </li>
              <li>
                <Link
                  to="/playground"
                  search={{ tab: "translit" }}
                  className="hover:text-foreground"
                >
                  <T k="footer.transliteration" />
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <Link to="/events" className="hover:text-foreground">
                  <T k="nav.events" />
                </Link>
                <a
                  href="/events-feed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-400 transition"
                  title={t("footer.rss")}
                  aria-label={t("footer.rss")}
                  lang={rssLang}
                >
                  <Rss size={13} />
                </a>
              </li>
              <li>
                <Link to="/communities" className="hover:text-foreground">
                  <T k="footer.communities" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">
              <T k="footer.research" />
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/papers" className="hover:text-foreground">
                  <T k="footer.papers" />
                </Link>
              </li>
              <li>
                <Link to="/treebank" className="hover:text-foreground">
                  <T k="footer.treebank" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">
              <T k="footer.develop" />
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/api" className="hover:text-foreground">
                  API
                </Link>
              </li>
              <li>
                <Link to="/contribute" className="hover:text-foreground">
                  <T k="footer.add" />
                </Link>
              </li>
              <li>
                <Link to="/translation-status" className="hover:text-foreground">
                  <T k="footer.translations" />
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-foreground">
                  <T k="nav.about" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">
              <T k="footer.connect" />
            </h4>
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
            © {new Date().getFullYear()} OpenOdia · <T k="footer.built" />{" "}
            <Heart size={12} className="inline text-magenta" aria-hidden="true" />
            <span className="sr-only">
              <T k="footer.love" />
            </span>{" "}
            <T k="footer.odisha" />
          </p>
          <p lang="or">{ODIA_PHRASE}</p>
          <a href="/pattachitra/PROVENANCE.md" className="hover:text-foreground">
            <T k="footer.art" />
          </a>
        </div>
      </div>
    </footer>
  );
}
