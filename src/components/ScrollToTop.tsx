import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 300);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="scroll-to-top-btn anim-fade group fixed bottom-6 right-6 z-40 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface/80 p-0 text-muted-foreground shadow-lg backdrop-blur-md hover:border-neon hover:text-neon"
      aria-label="Scroll to top"
    >
      <ArrowUp
        size={18}
        className="transition-transform duration-200 group-hover:-translate-y-0.5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-neon/5 to-magenta/5 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
