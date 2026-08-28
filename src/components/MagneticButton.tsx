import { useRef, type ReactNode, type MouseEvent } from "react";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  external?: boolean;
};

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  external,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  // The offset is written straight to the node rather than held in state.
  // A setState per mousemove re-rendered this subtree at pointer frequency,
  // and framer-motion then ran a spring on top of it — for a 6px nudge.
  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    const span = inner.current;
    if (!el || !span) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.25;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.25;
    span.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const reset = () => {
    if (inner.current) inner.current.style.transform = "";
  };

  const base =
    variant === "primary"
      ? "bg-gradient-to-r from-neon to-magenta text-primary-foreground"
      : "border border-border text-foreground hover:border-neon hover:text-neon";

  const content = (
    <span
      ref={inner}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform duration-150 ease-out ${base} ${className}`}
    >
      {children}
    </span>
  );

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className="inline-block">
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          onClick={onClick}
        >
          {content}
        </a>
      ) : onClick ? (
        <button type="button" onClick={onClick}>
          {content}
        </button>
      ) : (
        // No href and no handler means this sits inside a <Link>; a <button>
        // there would be interactive-inside-interactive and a second tab stop.
        content
      )}
    </div>
  );
}
