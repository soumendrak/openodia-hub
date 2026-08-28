/**
 * Citation strings for catalog entries.
 *
 * Only facts the catalog actually holds go in — name, owning author/org, URL,
 * and the year the resource was published — rendered as a `@misc` entry, the
 * same fallback Hugging Face uses when a card declares no citation. Nothing
 * here invents a paper title, venue, or author list: an entry whose upstream
 * publishes a real BibTeX block should carry that instead.
 */

export type CitableEntry = {
  /** Human-facing resource name, e.g. "OdiEnCorp-2.0". */
  name: string;
  /** Owning account or organisation, e.g. "shantipriyap". */
  author: string;
  url: string;
  /** ISO date the resource was created/published upstream; optional. */
  createdAt?: string;
};

/** BibTeX keys must be ASCII and free of separators. */
function bibKey(entry: CitableEntry, year: string): string {
  const slug = `${entry.author}_${entry.name}`
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return year ? `${slug}_${year}` : slug;
}

function yearOf(entry: CitableEntry): string {
  const year = entry.createdAt?.slice(0, 4) ?? "";
  return /^\d{4}$/.test(year) ? year : "";
}

/** Braces and backslashes would terminate the field early. */
function bibEscape(value: string): string {
  return value.replace(/[\\{}]/g, "");
}

export function toBibTeX(entry: CitableEntry): string {
  const year = yearOf(entry);
  const fields = [
    `  title = {${bibEscape(entry.name)}}`,
    `  author = {${bibEscape(entry.author)}}`,
    ...(year ? [`  year = {${year}}`] : []),
    `  howpublished = {\\url{${entry.url}}}`,
    `  note = {Listed on OpenOdia, https://openodia.com}`,
  ];
  return `@misc{${bibKey(entry, year)},\n${fields.join(",\n")}\n}`;
}

export function toApa(entry: CitableEntry): string {
  const year = yearOf(entry);
  return `${entry.author}. (${year || "n.d."}). ${entry.name} [Computer software]. Retrieved from ${entry.url}`;
}
