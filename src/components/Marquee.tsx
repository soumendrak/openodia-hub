import { useState } from "react";

type Props = { items: string[] };

export function Marquee({ items }: Props) {
  const list = [...items, ...items];
  const [paused, setPaused] = useState(false);
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40 py-6">
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
        className="relative z-10 mb-3 rounded border border-border bg-background px-3 py-1 text-sm"
      >
        {paused ? "Resume scrolling" : "Pause scrolling"}
      </button>
      <div
        style={{ animationPlayState: paused ? "paused" : "running" }}
        className="flex w-max gap-12 animate-marquee whitespace-nowrap font-display text-3xl text-muted-foreground md:text-5xl"
      >
        {list.map((item, i) => (
          <span key={i} aria-hidden={i >= items.length} className="flex items-center gap-12">
            <span className="transition hover:text-gradient">{item}</span>
            <span aria-hidden="true" className="text-neon">
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
