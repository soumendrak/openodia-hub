type Props = { items: string[] };

export function Marquee({ items }: Props) {
  const list = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40 py-6">
      <div className="flex w-max gap-12 animate-marquee whitespace-nowrap font-display text-3xl text-muted-foreground md:text-5xl">
        {list.map((item, i) => (
          <span key={i} className="flex items-center gap-12">
            <span className="transition hover:text-gradient">{item}</span>
            <span className="text-neon">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
