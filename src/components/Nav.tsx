import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon, Search, Languages, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, type TranslationKey } from "../lib/i18n";

/** `highlight` gives Playground the accent treatment — it's the one tab that
 *  runs something rather than listing something. `menuOnly` keeps a destination
 *  out of the desktop row: the header is capped at max-w-6xl, so ten tabs
 *  overflow it at *every* width — they only ever looked fine because the
 *  overflow was clipped. */
const links: ReadonlyArray<{
  to: string;
  labelKey: TranslationKey;
  highlight?: boolean;
  menuOnly?: boolean;
}> = [
  { to: "/", labelKey: "nav.home" },
  { to: "/tools", labelKey: "nav.tools" },
  { to: "/models", labelKey: "nav.models" },
  { to: "/datasets", labelKey: "nav.datasets" },
  { to: "/playground", labelKey: "nav.playground", highlight: true },
  { to: "/tutorials", labelKey: "nav.tutorials" },
  { to: "/events", labelKey: "nav.events" },
  { to: "/about", labelKey: "nav.about" },
  // Reachable from the menu at any width, plus the footer and ⌘K.
  { to: "/contribute", labelKey: "nav.contribute", menuOnly: true },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const { location } = useRouterState();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { locale, setLocale, t } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      if (nextTheme === "light") {
        document.documentElement.classList.add("light");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.classList.remove("light");
        localStorage.setItem("theme", "dark");
      }
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3 backdrop-blur-xl">
          <Link to="/" className="group flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-magenta text-primary-foreground font-display text-xl font-bold transition-transform group-hover:rotate-12">
              ଓ
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">OpenOdia</span>
          </Link>

          {/* Nine tabs need ~1056px against a 1118px inner width, so the row
              starts at xl; below that everything lives in the menu. */}
          <nav className="hidden items-center gap-1 xl:flex">
            {links
              .filter((l) => !l.menuOnly)
              .map((l) => {
                const active = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`relative rounded-lg border px-3 py-2 text-sm transition ${
                      l.highlight
                        ? "border-neon/40 bg-neon/5 text-neon hover:border-neon hover:bg-neon/15"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-lg bg-surface-2"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative inline-flex items-center gap-1.5">
                      {l.highlight && <Sparkles size={13} />}
                      {t(l.labelKey)}
                    </span>
                  </Link>
                );
              })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("openCommandPalette"))}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2 text-sm text-muted-foreground transition hover:border-neon hover:text-neon cursor-pointer"
              aria-label={t("nav.search.aria")}
            >
              <Search size={16} />
              <kbd className="hidden font-mono text-[10px] tracking-wider md:inline">⌘K</kbd>
            </button>

            {/* Two locales, so a single toggle labeled in the *target* language
                (USWDS pattern) — and visible at every width: mobile is the
                majority of the audience. */}
            <button
              onClick={() => setLocale(locale === "en" ? "or" : "en")}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface/40 px-2 py-2 text-xs text-muted-foreground transition hover:border-neon hover:text-neon cursor-pointer"
              aria-label={t("nav.locale.aria")}
              title={t("nav.locale.aria")}
            >
              <Languages size={14} className="hidden sm:block" />
              <span lang={locale === "en" ? "or" : "en"}>
                {locale === "en" ? "ଓଡ଼ିଆ" : "English"}
              </span>
            </button>

            <button
              onClick={toggleTheme}
              className="rounded-xl border border-border bg-surface/40 p-2 text-muted-foreground transition hover:border-neon hover:text-neon cursor-pointer"
              aria-label={t("nav.theme.aria")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="xl:hidden rounded-xl border border-border bg-surface/40 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setOpen((v) => !v)}
              aria-label={t("nav.menu.aria")}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur-xl xl:hidden"
            >
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                    l.highlight
                      ? "border-neon/40 bg-neon/5 text-neon"
                      : "border-transparent hover:bg-surface-2"
                  }`}
                >
                  {l.highlight && <Sparkles size={14} />}
                  {t(l.labelKey)}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
