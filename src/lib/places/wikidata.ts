import { externalFetch, timeoutSignal } from "@/lib/net";
import { USER_AGENT, type Fetcher } from "./overpass";

export const WIKIDATA_BATCH = 50;
export const WIKIDATA_TIMEOUT_MS = 10_000;

// Sitelinks ending in "wiki" that are not language editions of Wikipedia.
const NOT_WIKIPEDIA = new Set([
  "commonswiki",
  "specieswiki",
  "metawiki",
  "mediawikiwiki",
  "wikidatawiki",
  "sourceswiki",
  "wikimaniawiki",
  "outreachwiki",
  "foundationwiki",
  "incubatorwiki",
  "wikifunctionswiki",
]);

/** Number of Wikipedia language editions with an article, from a wbgetentities sitelinks object. */
export function countWikipedias(sitelinks: Record<string, unknown> | undefined): number {
  if (!sitelinks) return 0;
  return Object.keys(sitelinks).filter((key) => /^[a-z_]+wiki$/.test(key) && !NOT_WIKIPEDIA.has(key)).length;
}

export function wikidataBatchUrls(ids: readonly string[], props = "sitelinks"): string[] {
  const unique = [...new Set(ids)].filter((id) => /^Q[1-9]\d*$/.test(id)).sort();
  const urls: string[] = [];
  for (let i = 0; i < unique.length; i += WIKIDATA_BATCH) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: unique.slice(i, i + WIKIDATA_BATCH).join("|"),
      props,
      ...(props.includes("labels") ? { languages: "tr|en" } : {}),
      format: "json",
      // No maxlag: it is meant for background bots and rejects reads whenever replicas lag.
    });
    urls.push(`https://www.wikidata.org/w/api.php?${params}`);
  }
  return urls;
}

/** Wikipedia language counts per Wikidata ID, fetched in batches of 50. Throws if any batch fails. */
export async function fetchWikipediaCounts(
  ids: readonly string[],
  { fetcher = externalFetch, timeoutMs = WIKIDATA_TIMEOUT_MS }: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const url of wikidataBatchUrls(ids)) {
    const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT }, signal: timeoutSignal(timeoutMs) });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    const json = (await res.json()) as { entities?: Record<string, { sitelinks?: Record<string, unknown> }>; error?: unknown };
    if (!json.entities) throw new Error("Wikidata: no entities");
    for (const [id, entity] of Object.entries(json.entities)) counts.set(id, countWikipedias(entity.sitelinks));
  }
  return counts;
}

/** Sitelinks count, Turkish and English labels, and the English Wikipedia article's title (as Wikipedia writes it). */
export type EntitySummary = { wikipedias: number; tr?: string; en?: string; enwiki?: string };

/** Wikipedia language counts and Turkish/English labels per Wikidata ID, in batches of 50. Throws if any batch fails. */
export async function fetchEntitySummaries(
  ids: readonly string[],
  { fetcher = externalFetch, timeoutMs = WIKIDATA_TIMEOUT_MS }: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<Map<string, EntitySummary>> {
  const out = new Map<string, EntitySummary>();
  for (const url of wikidataBatchUrls(ids, "sitelinks|labels")) {
    const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT }, signal: timeoutSignal(timeoutMs) });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    type Entity = { sitelinks?: Record<string, { title?: string } | undefined>; labels?: Record<string, { value: string }> };
    const json = (await res.json()) as { entities?: Record<string, Entity> };
    if (!json.entities) throw new Error("Wikidata: no entities");
    for (const [id, entity] of Object.entries(json.entities)) {
      const tr = entity.labels?.tr?.value;
      const en = entity.labels?.en?.value;
      const enwiki = entity.sitelinks?.enwiki?.title;
      out.set(id, { wikipedias: countWikipedias(entity.sitelinks), ...(tr ? { tr } : {}), ...(en ? { en } : {}), ...(enwiki ? { enwiki } : {}) });
    }
  }
  return out;
}
