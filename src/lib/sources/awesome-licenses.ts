/**
 * Licenses for the curated Awesome-Odia-AI rows.
 *
 * The README states a license in prose for only ~12% of its entries, but
 * almost every row points at a GitHub repo or a Hugging Face model/dataset
 * that declares one upstream. Without this lookup the /tools directory badged
 * the great majority of curated entries "No license" — not because they have
 * none, but because nobody wrote it into the README blurb.
 *
 * Resolution goes through `loadResource`, which reads the already-cached
 * repo/model/dataset lists first and only pays for an upstream call on the
 * entries those lists don't carry.
 */
import { mapWithConcurrency } from "../fetch-utils";
import { refFromUrl, refToPath } from "../resource-id";
import { loadAwesome } from "./awesome";
import { cachedJson } from "./cache";
import { loadResource } from "./resource";

const TTL_MS = 60 * 60 * 1000;

/** Permalink path (`/r/gh/owner/repo`) → SPDX id. Entries with none are omitted. */
export type LicenseMap = Record<string, string>;

export async function loadAwesomeLicenses(): Promise<LicenseMap> {
  return cachedJson("awesome-licenses", TTL_MS, async () => {
    const items = await loadAwesome();
    const refs = new Map(
      items.flatMap((item) => {
        const ref = refFromUrl(item.url);
        return ref ? ([[refToPath(ref), ref]] as const) : [];
      }),
    );
    const resolved = await mapWithConcurrency([...refs], 12, async ([key, ref]) => {
      const resource = await loadResource(ref).catch(() => null);
      return [key, resource?.license ?? ""] as const;
    });
    return Object.fromEntries(resolved.filter(([, license]) => license));
  });
}
