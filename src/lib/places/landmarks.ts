import { distanceKm } from "@/lib/geo";
import { externalFetch, timeoutSignal } from "@/lib/net";
import { USER_AGENT, type Fetcher } from "./overpass";
import { HERITAGE_TAG, KIND_CLASSES, UNESCO_TAG, WORLD_HERITAGE_QID, type KindTag } from "./kinds";
import { fetchEntitySummaries } from "./wikidata";

/**
 * Must-see places from Wikidata, used only by the data script (`npm run
 * data:places`), never at request time. OSM tags miss many famous buildings
 * (Casa Batlló is a "residential building"), so the Wikidata Query Service is
 * asked for items near the city centre whose type is a sight, and the result
 * is merged into the OSM lists.
 *
 * Two small queries keep WDQS fast and polite: candidates with their direct
 * types (no subclass paths), then which of those types are subclasses of the
 * sight classes below. A third (kindsQuery) tags every sight with the kinds the
 * read-time rules use (rules.ts).
 */
export const WDQS_URL = "https://query.wikidata.org/sparql";
export const WDQS_TIMEOUT_MS = 65_000;
/** Candidates need at least this many sitelinks before any further check. */
export const MIN_SITELINKS = 12;
/** Places beyond the city radius (up to twice it) count only with this many Wikipedia languages. */
export const FAR_MIN_WIKIPEDIAS = 40;

/** Types that make an item a sight, with all their subclasses. */
export const SIGHT_CLASSES = {
  Q570116: "tourist attraction",
  Q2319498: "landmark",
  Q24398318: "religious building",
  Q16560: "palace",
  Q23413: "castle",
  Q22698: "park",
  Q33506: "museum",
  Q174782: "square",
  Q12280: "bridge",
  Q12518: "tower",
  Q4989906: "monument",
  Q839954: "archaeological site",
  Q57821: "fortification",
  Q483453: "fountain",
  Q1107656: "garden",
  Q358: "heritage site",
  Q1497375: "architectural ensemble",
  Q676050: "old town",
  Q41176: "building",
  Q811979: "architectural structure",
} as const;



/**
 * A museum that is also one of these is filed as a sight, not a museum: the
 * Colosseum (archaeological site), Park Güell (park), the Tower of London (castle).
 */
export const SIGHT_FIRST_CLASSES = {
  Q22698: "park",
  Q1107656: "garden",
  Q839954: "archaeological site",
  Q23413: "castle",
  Q16560: "palace",
  Q24398318: "religious building",
  Q12280: "bridge",
  Q12518: "tower",
  Q4989906: "monument",
  Q483453: "fountain",
  Q174782: "square",
  Q57821: "fortification",
} as const;

/**
 * Kinds of these items (kinds.ts): which of the rule classes they belong to, through subclass paths, and
 * whether they have a heritage designation or are World Heritage.
 */
export function kindsQuery(qids: readonly string[]): string {
  // Bottom up, in the written order (optimizer off): each item's types, then their superclasses. Top down
  // from classes like "business" would walk huge subclass trees. DISTINCT: many paths reach one class.
  return `SELECT DISTINCT ?item ?class WHERE {
  hint:Query hint:optimizer "None" .
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} }
  { ?item wdt:P31 ?type . ?type wdt:P279* ?class . FILTER(?class IN (${Object.keys(KIND_CLASSES).map((c) => `wd:${c}`).join(", ")})) }
  UNION { ?item wdt:P1435 ?listing . BIND(IF(?listing = wd:${WORLD_HERITAGE_QID}, "${UNESCO_TAG}", "${HERITAGE_TAG}") AS ?class) }
}`;
}

/** qid → its kind tags, sorted. */
export function parseKinds(json: unknown): Map<string, KindTag[]> {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const tags = new Map<string, Set<KindTag>>();
  for (const b of rows) {
    const item = qidOf(b.item?.value);
    const value = b.class?.value ?? "";
    const cls = qidOf(value);
    const tag: KindTag | undefined =
      value === UNESCO_TAG || value === HERITAGE_TAG ? value : cls ? KIND_CLASSES[cls as keyof typeof KIND_CLASSES] : undefined;
    if (!item || !tag) continue;
    if (!tags.has(item)) tags.set(item, new Set());
    tags.get(item)!.add(tag);
    // A World Heritage Site is a heritage listing too.
    if (tag === UNESCO_TAG) tags.get(item)!.add(HERITAGE_TAG);
  }
  return new Map([...tags].map(([item, set]) => [item, [...set].sort()]));
}

/** Items per kinds query: small enough for a quick, polite WDQS request. */
export const KINDS_BATCH = 100;

/** Kind tags for the city's sights, museums and viewpoints, in batches. Throws if any batch fails. */
export async function fetchKinds(
  qids: readonly string[],
  { fetcher = externalFetch }: { fetcher?: Fetcher } = {},
): Promise<Map<string, KindTag[]>> {
  const unique = [...new Set(qids)].filter((q) => /^Q[1-9]\d*$/.test(q)).sort();
  const kinds = new Map<string, KindTag[]>();
  for (let i = 0; i < unique.length; i += KINDS_BATCH) {
    for (const [item, tags] of parseKinds(await sparql(kindsQuery(unique.slice(i, i + KINDS_BATCH)), fetcher))) kinds.set(item, tags);
  }
  return kinds;
}

/** All coordinates (P625) of these items, in batches; an item without one maps to []. Throws if any batch fails. */
export async function fetchCoordinates(
  qids: readonly string[],
  { fetcher = externalFetch }: { fetcher?: Fetcher } = {},
): Promise<Map<string, Array<{ lat: number; lon: number }>>> {
  const unique = [...new Set(qids)].filter((q) => /^Q[1-9]\d*$/.test(q)).sort();
  const coords = new Map<string, Array<{ lat: number; lon: number }>>(unique.map((q) => [q, []]));
  for (let i = 0; i < unique.length; i += KINDS_BATCH) {
    const query = `SELECT ?item ?coord WHERE {
  VALUES ?item { ${unique.slice(i, i + KINDS_BATCH).map((q) => `wd:${q}`).join(" ")} }
  ?item wdt:P625 ?coord .
}`;
    const rows = (await sparql(query, fetcher)) as { results?: { bindings?: Binding[] } };
    for (const b of rows.results?.bindings ?? []) {
      const at = point(b.coord?.value);
      const item = qidOf(b.item?.value);
      if (at && item) coords.get(item)?.push(at);
    }
  }
  return coords;
}

export type Landmark = {
  qid: string;
  /** Turkish label, else English. */
  name: string;
  enLabel?: string;
  lat: number;
  lon: number;
  /** Straight-line distance from the city centre. */
  distKm: number;
  /** Wikipedia language editions with an article (the measure shown as "Vikipedi'de N dilde"). */
  wikipedias: number;
  /** ISO 3166-1 alpha-2 codes of the item's countries; empty when Wikidata gives none. */
  countries: string[];
  museum: boolean;
};

type Binding = Record<string, { value: string } | undefined>;

/** Items near the centre with their direct types; demolished ones (P576) are left out. */
export function candidatesQuery(lat: number, lon: number, radiusKm: number): string {
  return `SELECT ?item ?coord ?dist
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?type), "entity/"); separator=" ") AS ?types)
  (GROUP_CONCAT(DISTINCT ?cc; separator=" ") AS ?ccs)
WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
    bd:serviceParam wikibase:distance ?dist .
  }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  FILTER NOT EXISTS { ?item wdt:P576 ?demolished }
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?cc } }
}
GROUP BY ?item ?coord ?dist`;
}

export function typesQuery(types: readonly string[]): string {
  const classes = Object.keys({ ...SIGHT_CLASSES, ...SIGHT_FIRST_CLASSES });
  return `SELECT ?type ?class WHERE {
  VALUES ?type { ${types.map((t) => `wd:${t}`).join(" ")} }
  VALUES ?class { ${classes.map((c) => `wd:${c}`).join(" ")} }
  ?type wdt:P279* ?class .
}`;
}

const qidOf = (uri: string | undefined) => /Q[1-9]\d*$/.exec(uri ?? "")?.[0] ?? null;

/** "Point(2.17 41.38)" → { lat, lon } */
function point(wkt: string | undefined): { lat: number; lon: number } | null {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt ?? "");
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

export type Candidate = { qid: string; lat: number; lon: number; distKm: number; countries: string[]; types: string[] };

export function parseCandidates(json: unknown): Candidate[] {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const byQid = new Map<string, Candidate>();
  for (const b of rows) {
    const qid = qidOf(b.item?.value);
    const at = point(b.coord?.value);
    if (!qid || !at) continue;
    const distKm = Number(b.dist?.value);
    const previous = byQid.get(qid);
    // Items with several coordinates appear more than once: keep the nearest point.
    if (previous && previous.distKm <= distKm) continue;
    byQid.set(qid, {
      qid,
      ...at,
      distKm,
      countries: (b.ccs?.value ?? "").split(" ").filter((c) => /^[A-Z]{2}$/.test(c)),
      types: (b.types?.value ?? "").split(" ").filter((t) => /^Q[1-9]\d*$/.test(t)),
    });
  }
  return [...byQid.values()];
}

/** type → the listed classes it belongs to (via subclass paths). */
export function parseTypeClasses(json: unknown): Map<string, Set<string>> {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const map = new Map<string, Set<string>>();
  for (const b of rows) {
    const type = qidOf(b.type?.value);
    const cls = qidOf(b.class?.value);
    if (!type || !cls) continue;
    if (!map.has(type)) map.set(type, new Set());
    map.get(type)!.add(cls);
  }
  return map;
}

/**
 * Keeps candidates of a sight type (a building, park, monument…) in the destination's country, or the
 * Vatican, which is visited from Rome; items whose country Wikidata does not give are kept. Which of them
 * are shown (no stations, hotels, clubs…) is decided on read, from their kinds (rules.ts).
 */
export function classify(
  candidates: readonly Candidate[],
  typeClasses: Map<string, Set<string>>,
  countryCode: string,
): Array<Candidate & { museum: boolean }> {
  const has = (c: Candidate, classes: object) =>
    c.types.some((t) => t in classes || [...(typeClasses.get(t) ?? [])].some((cls) => cls in classes));
  return candidates
    .filter((c) => has(c, SIGHT_CLASSES))
    .filter((c) => c.countries.length === 0 || c.countries.includes(countryCode) || c.countries.includes("VA"))
    .map((c) => ({ ...c, museum: has(c, { Q33506: true }) && !has(c, SIGHT_FIRST_CLASSES) }));
}

export async function sparql(query: string, fetcher: Fetcher): Promise<unknown> {
  const res = await fetcher(WDQS_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query }).toString(),
    signal: timeoutSignal(WDQS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`WDQS HTTP ${res.status}`);
  return res.json();
}

/**
 * Sights within twice the city radius, with Wikipedia counts and labels,
 * most known first. Beyond the city radius only very well known places stay
 * (at least 40 Wikipedia languages), so Park Güell is in and suburbs are not.
 */
export async function fetchLandmarks(
  city: { lat: number; lon: number; radiusKm: number; countryCode: string },
  { fetcher = externalFetch }: { fetcher?: Fetcher } = {},
): Promise<Landmark[]> {
  const candidates = parseCandidates(await sparql(candidatesQuery(city.lat, city.lon, city.radiusKm * 2), fetcher));
  const types = [...new Set(candidates.flatMap((c) => c.types))].sort();
  const typeClasses = types.length ? parseTypeClasses(await sparql(typesQuery(types), fetcher)) : new Map<string, Set<string>>();
  const sights = classify(candidates, typeClasses, city.countryCode);
  const summaries = await fetchEntitySummaries(sights.map((s) => s.qid), { fetcher });
  return sights
    .flatMap((s): Landmark[] => {
      const info = summaries.get(s.qid);
      const name = info?.tr ?? info?.en;
      if (!info || !name) return [];
      if (s.distKm > city.radiusKm && info.wikipedias < FAR_MIN_WIKIPEDIAS) return [];
      return [
        {
          qid: s.qid,
          name,
          ...(info.en && info.en !== name ? { enLabel: info.en } : {}),
          lat: s.lat,
          lon: s.lon,
          distKm: s.distKm,
          wikipedias: info.wikipedias,
          countries: s.countries,
          museum: s.museum,
        },
      ];
    })
    .sort((a, b) => b.wikipedias - a.wikipedias || (a.qid < b.qid ? -1 : 1));
}

/** Distance helper re-exported for the merge step. */
export const kmBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceKm(a.lat, a.lon, b.lat, b.lon);
