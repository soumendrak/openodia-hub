import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/tools", label: "Tools" },
  { to: "/tutorials", label: "Tutorials" },
  { to: "/events", label: "Events" },
  { to: "/about", label: "About" },
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const { location } = useRouterState();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

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

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = location.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="relative rounded-lg px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-surface-2"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{l.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-border bg-surface/40 p-2 text-muted-foreground transition hover:border-neon hover:text-neon cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <a
              href="https://github.com/soumendrak/openodia-hub"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm font-medium transition hover:border-neon hover:text-neon md:inline-block"
            >
              GitHub
            </a>

            <button
              className="md:hidden rounded-xl border border-border bg-surface/40 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
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
              className="mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur-xl md:hidden"
            >
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm hover:bg-surface-2"
                >
                  {l.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
