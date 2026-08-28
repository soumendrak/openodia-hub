/**
 * The other Odia catalogs.
 *
 * Odia resources are spread across at least three overlapping lists — the
 * fragmentation the low-resource-NLP literature names as the top discovery
 * problem. Reading them all and merging on the permalink turns "a fourth
 * partial catalog" into cross-references: one entry that says which lists carry
 * it.
 */
import { fetchWithTimeout } from "../fetch-utils";
import { parseReadme, type Item } from "./awesome";
import { cachedJson } from "./cache";

export type ExternalCatalog = {
  id: string;
  name: string;
  url: string;
  readmeUrl: string;
  /** False for pan-Indic lists, where only the Odia rows are relevant. */
  odiaOnly: boolean;
};

export const CATALOGS: ExternalCatalog[] = [
  {
    id: "odia-nlp-catalog",
    name: "Odia-NLP-Resource-Catalog",
    url: "https://github.com/shantipriyap/Odia-NLP-Resource-Catalog",
    readmeUrl:
      "https://raw.githubusercontent.com/shantipriyap/Odia-NLP-Resource-Catalog/master/README.md",
    odiaOnly: true,
  },
  {
    id: "indicnlp-catalog",
    name: "indicnlp_catalog",
    url: "https://github.com/AI4Bharat/indicnlp_catalog",
    readmeUrl: "https://raw.githubusercontent.com/AI4Bharat/indicnlp_catalog/master/README.md",
    odiaOnly: false,
  },
];

const TTL_MS = 6 * 60 * 60 * 1000;
const MENTIONS_ODIA = /\bodia\b|\boriya\b|\bodisha\b/i;

export type CatalogItems = { catalog: ExternalCatalog; items: Item[] };

async function loadOne(catalog: ExternalCatalog): Promise<CatalogItems> {
  const r = await fetchWithTimeout(catalog.readmeUrl, {
    headers: { "User-Agent": "openodia.com" },
  });
  if (!r.ok) throw new Error(`${catalog.id}_${r.status}`);
  let items = parseReadme(await r.text());
  if (!catalog.odiaOnly) {
    // A pan-Indic list's Hindi rows are not Odia resources.
    items = items.filter((i) => MENTIONS_ODIA.test(`${i.name} ${i.description} ${i.subcategory}`));
  }
  return { catalog, items };
}

/** Catalogs that fail are simply absent — one dead list must not blank the rest. */
export async function loadExternalCatalogs(): Promise<CatalogItems[]> {
  return cachedJson("external-catalogs", TTL_MS, async () => {
    const settled = await Promise.allSettled(CATALOGS.map(loadOne));
    const out: CatalogItems[] = [];
    for (const [i, result] of settled.entries()) {
      if (result.status === "fulfilled") out.push(result.value);
      else console.warn(`catalog ${CATALOGS[i].id} failed:`, result.reason);
    }
    return out;
  });
}

/**
 * Human-facing names for the catalogs a record can be listed in. `github` and
 * `huggingface` are deliberately absent — those are where the resource lives,
 * not lists that carry it, and the detail page already links there.
 */
export const CATALOG_SOURCES: Record<string, { name: string; url: string }> = {
  "awesome-odia-ai": {
    name: "Awesome-Odia-AI",
    url: "https://github.com/odisha-ml/Awesome-Odia-AI",
  },
  ...Object.fromEntries(CATALOGS.map((c) => [c.id, { name: c.name, url: c.url }])),
};
