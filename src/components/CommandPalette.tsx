import { Suspense, lazy, useEffect, useState } from "react";

/**
 * ⌘K launcher.
 *
 * Only the key listener lives in the entry bundle. The palette itself pulls in
 * cmdk, a Radix dialog, and four upstream fetchers — ~40KB that every visitor
 * used to download on every page for a surface most of them never open. It is
 * fetched on the first open and stays mounted after that, so the second ⌘K is
 * instant.
 */
const CommandPaletteDialog = lazy(() => import("./CommandPaletteDialog"));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // Distinct from `open`: once loaded the dialog stays mounted so closing it
  // doesn't throw away the fetched results.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const openPalette = () => {
      setLoaded(true);
      setOpen(true);
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    window.addEventListener("openCommandPalette", openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("openCommandPalette", openPalette);
    };
  }, []);

  if (!loaded) return null;

  return (
    // No fallback: the dialog is its own overlay, and a spinner that flashes
    // for one frame on a warm cache is worse than nothing.
    <Suspense fallback={null}>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
