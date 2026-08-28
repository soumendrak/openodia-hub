import { type ReactNode } from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Seconds, to offset one block against the one above it. Capped — see below. */
  delay?: number;
};

/**
 * Hard ceiling on the entrance offset. Several callers pass an index-derived
 * delay (`i * 0.08`), which reads fine for three blocks and turns the twelfth
 * card in a grid into a half-second wait. Capping here rather than at each
 * call site keeps the invariant in one place: nothing on the page is ever more
 * than 150ms late, however long the list gets.
 */
const MAX_DELAY_S = 0.15;

/**
 * Section entrance.
 *
 * This used to be a framer-motion spring gated on `whileInView`, which meant
 * every block — including the ones already on screen — stayed at opacity 0
 * until an IntersectionObserver fired after hydration, then took ~600ms to
 * settle. The page loaded fast and felt slow, because you had to wait to read
 * it.
 *
 * Now it is a CSS animation that starts at first paint: no observer, no JS on
 * the main thread, and nothing to hydrate before the text is legible.
 */
export function Reveal({ children, delay = 0, className = "", style, ...rest }: Props) {
  const offset = Math.min(delay, MAX_DELAY_S);
  return (
    <div
      className={`anim-in ${className}`}
      style={offset ? { animationDelay: `${offset}s`, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  );
}
