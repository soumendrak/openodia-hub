import { useEffect, useState } from "react";

/**
 * Stops the Pattachitra hero's decorative animation while the tab is hidden.
 *
 * There are three slow, infinite animations on that panel; there's no reason
 * to spend frames on them when nobody is looking. The returned class name
 * drives `animation-play-state` in the .patta stylesheet — pausing rather than
 * removing, so returning to the tab doesn't snap the letter back to the start
 * of its turn.
 *
 * `prefers-reduced-motion` is handled entirely in CSS and needs no JS.
 */
export function usePattachitraMotion() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  /** Goes on the `.patta` element. */
  return `patta${hidden ? " page-hidden" : ""}`;
}
