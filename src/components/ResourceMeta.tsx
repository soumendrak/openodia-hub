import { useState } from "react";
import { Check, Copy, Quote } from "lucide-react";
import { isPermissive } from "../lib/license";
import { toApa, toBibTeX, type CitableEntry } from "../lib/citation";

/**
 * The metadata row shared by /tools, /models and /datasets cards: the license
 * a researcher checks first, and the citation they need second.
 *
 * The whole row lives *outside* the card's anchor — a <button> inside an <a>
 * is invalid HTML and doubles the tab stop. Disclosure is a native <details>,
 * so citations cost no JS until someone asks for them.
 */

export function LicenseBadge({ spdx }: { spdx: string }) {
  if (!spdx) {
    return (
      <span
        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
        title="No license declared upstream — check before reuse."
      >
        No license
      </span>
    );
  }
  const permissive = isPermissive(spdx);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] ${
        permissive
          ? "border-neon/40 bg-neon/5 text-neon"
          : "border-saffron/40 bg-saffron/5 text-saffron"
      }`}
      title={
        permissive
          ? `${spdx} — permissive; reusable with attribution.`
          : `${spdx} — check the terms before reuse (share-alike or non-commercial).`
      }
    >
      {spdx}
    </span>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => setCopied(false),
            );
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-neon hover:text-neon"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-1 max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-2 p-2 text-[10px] leading-relaxed">
        {value}
      </pre>
    </div>
  );
}

/**
 * License badge (plus any source-specific chips) as the summary; BibTeX and
 * APA as the disclosed body.
 */
export function ResourceMeta({
  license,
  entry,
  extra,
}: {
  license: string;
  entry: CitableEntry;
  extra?: React.ReactNode;
}) {
  return (
    <details className="border-t border-border">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <LicenseBadge spdx={license} />
        {extra}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-neon hover:text-neon">
          <Quote size={10} />
          Cite
        </span>
      </summary>
      <div className="px-5 pb-4">
        <CopyRow label="BibTeX" value={toBibTeX(entry)} />
        <CopyRow label="APA" value={toApa(entry)} />
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Generated from the catalog entry. If the project publishes its own citation, prefer that.
        </p>
      </div>
    </details>
  );
}
