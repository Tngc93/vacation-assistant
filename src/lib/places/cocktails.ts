import { distanceKm } from "@/lib/geo";
import { externalFetch } from "@/lib/net";
import { similarNames } from "./build";
import { MAX_STORED_PER_CATEGORY, type StoredPlace } from "./file";
import { sparql } from "./landmarks";
import type { Fetcher } from "./overpass";
import { compareRanked } from "./rank";

/**
 * Cocktail bars from Wikidata (data scripts only), the way landmarks.ts adds must-sees: OSM rarely tags a bar
 * for cocktails (`cocktails=yes`, `bar=cocktail`), so Barcelona had six and neither Boadas nor Paradiso.
 *
 * A Wikidata item is a cocktail bar when it is a cocktail lounge (Q30748895, with its subclasses), or a bar
 * (Q187456, with its subclasses: a pub too) that says "cocktail" (Q134768) as its type, product, cuisine or
 * field of work: Boadas is filed as "pub" and "cocktail". Closed ones (P576, P3999) are left out.
 *
 * Wikidata has few of them (about 60 with a coordinate, worldwide), so one query asks for all and each city keeps
 * those within its radius of the tourist centre. Each is matched to the city's OSM bars and pubs: by the OSM
 * object's wikidata tag, the item's OSM node or way ID (P11693, P10689), else by a similar name within 75 m. A
 * matched OSM bar moves to "Kokteyl bar" and leaves "Bar ve pub"; an unmatched item with a name and a coordinate
 * is added as a Wikidata place ("wikidata/Q122962985"), without opening hours (the plan says "SAATLERİ DOĞRULA").
 * Bars Wikidata knows come first, then OSM's by record detail: a Wikidata item is the only sign of note a bar has
 * (the card says "Wikidata'da kayıtlı"), and without it London's and New York's 30 would hide them.
 */
export const COCKTAIL_LOUNGE_QID = "Q30748895";
/** The drink: a bar's P31, P1056 (product), P2012 (cuisine) or P101 (field of work). */
export const COCKTAIL_QID = "Q134768";
export const BAR_QID = "Q187456";

/** Within this distance and with a similar name, an OSM bar without a wikidata tag is the Wikidata bar. */
export const COCKTAIL_MATCH_KM = 0.075;

export type CocktailBar = {
  qid: string;
  /** Turkish label, else English, else the multilingual one. */
  name: string;
  /** English label, when it differs from `name`. */
  enLabel?: string;
  lat: number;
  lon: number;
  /** The item's OSM object (P11693 node, P10689 way): "node/3898185143". */
  osmIds: string[];
};

export function cocktailBarsQuery(): string {
  return `SELECT ?item ?coord ?tr ?en ?mul ?node ?way WHERE {
  { ?item wdt:P31/wdt:P279* wd:${COCKTAIL_LOUNGE_QID} . }
  UNION { ?item wdt:P31|wdt:P1056|wdt:P2012|wdt:P101 wd:${COCKTAIL_QID} . ?item wdt:P31/wdt:P279* wd:${BAR_QID} . }
  ?item wdt:P625 ?coord .
  FILTER NOT EXISTS { ?item wdt:P576 ?closed }
  FILTER NOT EXISTS { ?item wdt:P3999 ?closedOn }
  OPTIONAL { ?item rdfs:label ?tr . FILTER(LANG(?tr) = "tr") }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul . FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item wdt:P11693 ?node }
  OPTIONAL { ?item wdt:P10689 ?way }
}`;
}

type Binding = Record<string, { value: string } | undefined>;
const qidOf = (uri: string | undefined) => /Q[1-9]\d*$/.exec(uri ?? "")?.[0] ?? null;

/** One bar per item, sorted by QID; an item with several coordinates keeps the first, one without a name is left out. */
export function parseCocktailBars(json: unknown): CocktailBar[] {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const byQid = new Map<string, CocktailBar>();
  for (const b of rows) {
    const qid = qidOf(b.item?.value);
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? "");
    const tr = b.tr?.value.trim();
    const en = b.en?.value.trim();
    const name = tr || en || b.mul?.value.trim();
    if (!qid || !m || !name) continue;
    const osm = [
      ...(/^\d+$/.test(b.node?.value ?? "") ? [`node/${b.node!.value}`] : []),
      ...(/^\d+$/.test(b.way?.value ?? "") ? [`way/${b.way!.value}`] : []),
    ];
    const previous = byQid.get(qid);
    if (previous) {
      previous.osmIds = [...new Set([...previous.osmIds, ...osm])].sort();
      continue;
    }
    byQid.set(qid, {
      qid,
      name,
      ...(en && en !== name ? { enLabel: en } : {}),
      lat: Number(m[2]),
      lon: Number(m[1]),
      osmIds: osm,
    });
  }
  return [...byQid.values()].sort((a, b) => (a.qid < b.qid ? -1 : 1));
}

/** Every cocktail bar Wikidata has with a coordinate: one small WDQS query. */
export async function fetchCocktailBars({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<CocktailBar[]> {
  return parseCocktailBars(await sparql(cocktailBarsQuery(), fetcher));
}

/** The bars within the city's radius of its tourist centre. */
export function barsNear(bars: readonly CocktailBar[], centre: { lat: number; lon: number }, radiusKm: number): CocktailBar[] {
  return bars.filter((b) => distanceKm(centre.lat, centre.lon, b.lat, b.lon) <= radiusKm);
}

/**
 * The OSM bars and pubs near the city's Wikidata cocktail bars (75 m) and their own OSM objects (data:places only):
 * the city query returns at most 400 bars and pubs, so in London or New York the one that is the Wikidata bar is
 * often not among them. Exact key=value filters only, as in categories.ts.
 */
export function cocktailLookupQuery(bars: readonly CocktailBar[], timeoutS = 60): string {
  const near = bars.flatMap((b) => {
    const at = `around:${COCKTAIL_MATCH_KM * 1000},${b.lat.toFixed(6)},${b.lon.toFixed(6)}`;
    return [`  nwr(${at})["amenity"="bar"]["name"];`, `  nwr(${at})["amenity"="pub"]["name"];`];
  });
  const ids = (type: "node" | "way") => {
    const list = [...new Set(bars.flatMap((b) => b.osmIds.filter((id) => id.startsWith(`${type}/`)).map((id) => id.slice(type.length + 1))))];
    return list.length ? [`  ${type}(id:${list.join(",")});`] : [];
  };
  return `[out:json][timeout:${timeoutS}];\n(\n${[...near, ...ids("node"), ...ids("way")].join("\n")}\n);\nout tags center;`;
}

type Matchable = { id: string; name: string; localName?: string; lat: number; lon: number; wikidataId?: string };

/** The OSM place that is this Wikidata bar: by wikidata tag, by the item's OSM ID, else by a similar name within 75 m. */
export function matchCocktailBar<T extends Matchable>(bar: CocktailBar, places: readonly T[]): T | undefined {
  const osm = places.filter((p) => !p.id.startsWith("wikidata/"));
  const names = [bar.name, bar.enLabel].filter((n): n is string => Boolean(n));
  return (
    osm.find((p) => p.wikidataId === bar.qid) ??
    osm.find((p) => bar.osmIds.includes(p.id) && (!p.wikidataId || p.wikidataId === bar.qid)) ??
    osm
      .filter((p) => !p.wikidataId && distanceKm(p.lat, p.lon, bar.lat, bar.lon) <= COCKTAIL_MATCH_KM)
      .find((p) => names.some((n) => similarNames(n, p.name) || (p.localName ? similarNames(n, p.localName) : false)))
  );
}

const round5 = (n: number) => Number(n.toFixed(5));

/** Bars Wikidata knows first, then record detail and the name (rank.ts): a total, stable order. */
export function compareCocktailBars(a: StoredPlace, b: StoredPlace): number {
  return Number(Boolean(b.wikidataId)) - Number(Boolean(a.wikidataId)) || compareRanked(a, b);
}

/**
 * The city's stored cocktail bars and pubs with the Wikidata bars joined in: a matched pub moves to the cocktail
 * bars (with the item's QID), a matched cocktail bar gets the QID, the rest are added as Wikidata places. Wikidata
 * places from an earlier run are dropped first, so running it again changes nothing.
 */
export function mergeCocktailBars(
  stored: { cocktail: readonly StoredPlace[]; pub: readonly StoredPlace[] },
  bars: readonly CocktailBar[],
): { cocktail: StoredPlace[]; pub: StoredPlace[]; matched: string[]; added: string[] } {
  let cocktail = stored.cocktail.filter((p) => !p.id.startsWith("wikidata/"));
  let pub = [...stored.pub];
  const matched: string[] = [];
  const added: string[] = [];
  for (const bar of bars) {
    const inCocktail = matchCocktailBar(bar, cocktail);
    if (inCocktail) {
      if (!inCocktail.wikidataId) cocktail = cocktail.map((p) => (p === inCocktail ? { ...p, wikidataId: bar.qid } : p));
      matched.push(inCocktail.id);
      continue;
    }
    const inPub = matchCocktailBar(bar, pub);
    if (inPub) {
      pub = pub.filter((p) => p !== inPub);
      cocktail.push({ ...inPub, wikidataId: bar.qid });
      matched.push(inPub.id);
      continue;
    }
    cocktail.push({
      id: `wikidata/${bar.qid}`,
      name: bar.name,
      ...(bar.enLabel ? { localName: bar.enLabel } : {}),
      lat: round5(bar.lat),
      lon: round5(bar.lon),
      wikidataId: bar.qid,
    });
    added.push(bar.qid);
  }
  return { cocktail: [...cocktail].sort(compareCocktailBars).slice(0, MAX_STORED_PER_CATEGORY), pub, matched, added };
}
