import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const lenis = (window as any).lenis;
    if (lenis) {
      lenis.scrollTo(0);
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 15 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.95 }}
          onClick={scrollToTop}
          className="scroll-to-top-btn group fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface/80 p-0 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:border-neon hover:text-neon cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-neon/5 to-magenta/5 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
