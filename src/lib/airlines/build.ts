import { sparql } from "@/lib/places/landmarks";
import type { Fetcher } from "@/lib/places/overpass";
import { externalFetch } from "@/lib/net";

/**
 * src/data/airlines.json: airline names by IATA designator from Wikidata (P229, CC0), written by
 * `npm run data:airlines`. Designators are reused after an airline closes, so items with an end (P576 dissolved,
 * P582 end time) are left out and, of the rest, the one with the most Wikipedia languages names the code
 * (TK: Türk Hava Yolları, not AJet; LH: Lufthansa, not Lufthansa Cargo). Turkish label, else English; the English
 * label, when it differs, in `airlinesEn` for the English interface (version 2, 2026-10-29).
 */
export const AIRLINES_FILE_VERSION = 2;

export type AirlinesFile = {
  version: number;
  fetchedAt: string;
  source: { name: string; url: string; terms: string };
  airlines: Record<string, string>;
  /** English names that differ from `airlines` (TK: Turkish Airlines). */
  airlinesEn: Record<string, string>;
};

export const AIRLINES_QUERY = `SELECT ?code ?item ?tr ?en ?links WHERE {
  ?item wdt:P229 ?code ; wikibase:sitelinks ?links .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  FILTER NOT EXISTS { ?item wdt:P582 ?ended }
  OPTIONAL { ?item rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
}`;

type Binding = Record<string, { value: string } | undefined>;

export function pickAirlines(json: unknown): Pick<AirlinesFile, "airlines" | "airlinesEn"> {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const best = new Map<string, { name: string; en?: string; links: number }>();
  for (const b of rows) {
    const code = b.code?.value.trim().toUpperCase();
    const name = (b.tr?.value ?? b.en?.value)?.trim();
    if (!code || !/^[A-Z0-9]{2}$/.test(code) || !name) continue;
    const links = Number(b.links?.value ?? 0) || 0;
    const current = best.get(code);
    if (!current || links > current.links) best.set(code, { name, en: b.en?.value.trim() || undefined, links });
  }
  const sorted = [...best].sort(([a], [b]) => a.localeCompare(b));
  return {
    airlines: Object.fromEntries(sorted.map(([code, { name }]) => [code, name])),
    airlinesEn: Object.fromEntries(sorted.flatMap(([code, { name, en }]) => (en && en !== name ? [[code, en]] : []))),
  };
}

export async function fetchAirlines({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<Pick<AirlinesFile, "airlines" | "airlinesEn">> {
  const picked = pickAirlines(await sparql(AIRLINES_QUERY, fetcher));
  if (Object.keys(picked.airlines).length < 500) throw new Error(`Wikidata: only ${Object.keys(picked.airlines).length} airlines`);
  return picked;
}
