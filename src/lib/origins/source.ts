import { externalFetch, timeoutSignal } from "@/lib/net";
import { sparql } from "@/lib/places/landmarks";
import { USER_AGENT, type Fetcher } from "@/lib/places/overpass";
import type { TpAirport, TpCity, WdLabels, WdServed } from "./build";

/**
 * Network side of `npm run data:origins`: Travelpayouts' static files (no token) and two Wikidata queries. Never
 * used by the app at run time.
 */

export const TP_DATA_URL = "https://api.travelpayouts.com/data";
const TP_TIMEOUT_MS = 60_000;
/** Labels are asked for this many places per query; one query for all of them times out. */
const LABEL_BATCH = 500;

async function tpFile<T>(lang: "en" | "tr", file: "cities" | "airports", fetcher: Fetcher): Promise<T[]> {
  const res = await fetcher(`${TP_DATA_URL}/${lang}/${file}.json`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: timeoutSignal(TP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Travelpayouts ${lang}/${file}.json HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length < 1000) throw new Error(`Travelpayouts ${lang}/${file}.json: unexpected shape`);
  return json as T[];
}

export async function fetchTravelpayouts({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}) {
  const [cities, citiesTr, airports, airportsTr] = await Promise.all([
    tpFile<TpCity>("en", "cities", fetcher),
    tpFile<TpCity>("tr", "cities", fetcher),
    tpFile<TpAirport>("en", "airports", fetcher),
    tpFile<TpAirport>("tr", "airports", fetcher),
  ]);
  return {
    cities,
    citiesTr: new Map(citiesTr.map((c) => [c.code, c.name])),
    airports,
    airportsTr: new Map(airportsTr.map((a) => [a.code, a.name])),
  };
}

type Binding = Record<string, { value: string } | undefined>;
const rows = (json: unknown): Binding[] => (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/** Every airport with an IATA code and the places it serves. */
export async function fetchServed({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<WdServed[]> {
  const json = await sparql("SELECT ?iata ?city WHERE { ?airport wdt:P238 ?iata ; wdt:P931 ?city . }", fetcher);
  return rows(json).flatMap((b) => (b.iata && b.city ? [{ iata: b.iata.value.toUpperCase(), qid: qidOf(b.city.value) }] : []));
}

export function labelsQuery(qids: readonly string[]): string {
  return `SELECT ?city ?tr ?en ?native ?links WHERE {
  VALUES ?city { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ?city wikibase:sitelinks ?links .
  OPTIONAL { ?city rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
  OPTIONAL { ?city rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?city wdt:P1705 ?native }
}`;
}

export function parseLabels(json: unknown, into = new Map<string, WdLabels>()): Map<string, WdLabels> {
  for (const b of rows(json)) {
    if (!b.city) continue;
    const qid = qidOf(b.city.value);
    const entry = into.get(qid) ?? { native: [], sitelinks: Number(b.links?.value ?? 0) || 0 };
    if (b.tr) entry.tr = b.tr.value;
    if (b.en) entry.en = b.en.value;
    if (b.native && !entry.native.includes(b.native.value)) entry.native.push(b.native.value);
    into.set(qid, entry);
  }
  return into;
}

/** Turkish, English and native labels and the Wikipedia count of every served place. */
export async function fetchLabels(qids: readonly string[], { fetcher = externalFetch }: { fetcher?: Fetcher } = {}) {
  const labels = new Map<string, WdLabels>();
  const unique = [...new Set(qids)].sort();
  for (let i = 0; i < unique.length; i += LABEL_BATCH) {
    parseLabels(await sparql(labelsQuery(unique.slice(i, i + LABEL_BATCH)), fetcher), labels);
  }
  return labels;
}
