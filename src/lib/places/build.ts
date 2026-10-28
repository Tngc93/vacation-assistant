import type { Destination } from "@/data/destinations";
import { CATEGORIES, type CategoryId } from "./categories";
import type { KindTag } from "./kinds";
import type { Landmark } from "./landmarks";
import { MAX_STORED_PER_CATEGORY, type StoredPlace } from "./file";
import { distanceKm, type Fetcher, type OverpassElement } from "./overpass";
import { toPlace, type Place } from "./place";
import { rankPlaces, type RankedPlace } from "./rank";
import { isSight } from "./rules";
import type { CityOverrides } from "@/data/place-overrides";
import { fetchWikipediaCounts } from "./wikidata";

const round5 = (n: number) => Number(n.toFixed(5));

/** Keeps only what the UI shows: no category (the file key), 5-decimal coordinates. */
export function slimPlace(place: RankedPlace): StoredPlace {
  const { category, ...rest } = place;
  return { ...rest, lat: round5(place.lat), lon: round5(place.lon) };
}

/**
 * Lowercase, no accents, letters and digits only: "Casa Milà" ≈ "CASA MILA". Not Turkish lowercase on
 * purpose: names come in many languages ("I" must become "i", and a Turkish "ı" matches it too).
 */
export const looseName = (name: string) =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The same name, loosely, or one containing the other when both have at least five letters. */
export function similarNames(a: string, b: string): boolean {
  const x = looseName(a);
  const y = looseName(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x)));
}

/** Within this distance and with a similar name, an OSM place without a Wikidata tag is the landmark. */
export const LANDMARK_MATCH_KM = 0.15;

export type LandmarkMerge = {
  /** OSM place id → the Wikidata item it was matched to by name and distance. */
  qidFor: Map<string, string>;
  /** OSM place id → its country, when the landmark it is (by tag or match) is abroad: St Peter's from Rome. */
  countryFor: Map<string, string>;
  /** Landmarks OSM does not have, as places (category see or museum). */
  extras: Place[];
  /** Wikipedia counts the landmark query already returned. */
  counts: Map<string, number>;
};

/**
 * Joins Wikidata landmarks to the OSM sights, museums and viewpoints: by the
 * OSM wikidata tag, else by a similar name within 150 m; the rest are added
 * with Wikidata's coordinates. A landmark outside the destination's country
 * (the Vatican from Rome) keeps its country code so the UI can say so.
 */
export function mergeLandmarks(osm: readonly Place[], landmarks: readonly Landmark[], countryCode: string): LandmarkMerge {
  const qidFor = new Map<string, string>();
  const countryFor = new Map<string, string>();
  const extras: Place[] = [];
  const counts = new Map(landmarks.map((l) => [l.qid, l.wikipedias]));
  const tagged = new Set(osm.flatMap((p) => (p.wikidataId ? [p.wikidataId] : [])));
  const abroadOf = (l: Landmark) => (l.countries.length > 0 && !l.countries.includes(countryCode) ? l.countries[0] : undefined);
  for (const l of landmarks) {
    const abroad = abroadOf(l);
    if (tagged.has(l.qid)) {
      if (abroad) for (const p of osm) if (p.wikidataId === l.qid) countryFor.set(p.id, abroad);
      continue;
    }
    const names = [l.name, l.enLabel].filter((n): n is string => Boolean(n));
    const match = osm
      .filter((p) => !p.wikidataId && !qidFor.has(p.id))
      .filter((p) => distanceKm(p.lat, p.lon, l.lat, l.lon) <= LANDMARK_MATCH_KM)
      .find((p) => names.some((n) => similarNames(n, p.name) || (p.localName ? similarNames(n, p.localName) : false)));
    if (match) {
      qidFor.set(match.id, l.qid);
      if (abroad) countryFor.set(match.id, abroad);
      continue;
    }
    extras.push({
      id: `wikidata/${l.qid}`,
      category: l.museum ? "museum" : "see",
      name: l.name,
      ...(l.enLabel ? { localName: l.enLabel } : {}),
      lat: l.lat,
      lon: l.lon,
      wikidataId: l.qid,
      ...(abroad ? { country: abroad } : {}),
    });
  }
  return { qidFor, countryFor, extras, counts };
}

export type BuildOptions = {
  fetcher?: Fetcher;
  /** Wikidata landmarks merged into sights and museums (see mergeLandmarks). */
  landmarks?: LandmarkMerge;
  /** Wikidata kind tags per item (kinds.ts), stored with each sight for the read-time rules. */
  kinds?: ReadonlyMap<string, readonly KindTag[]>;
  /** The city's hand-kept exceptions, so the places they include are counted as sights when choosing what to keep. */
  overrides?: CityOverrides;
  /**
   * OSM bars and pubs that are Wikidata cocktail bars (cocktails.ts), as cocktail places with the item's QID:
   * they are left out of "Bar ve pub" and added to "Kokteyl bar".
   */
  cocktailBars?: readonly Place[];
  /** Wraps the Wikidata call (the data script adds retries and back-off). */
  retry?: <T>(label: string, task: () => Promise<T>) => Promise<T>;
};

/**
 * Overpass elements (plus Wikidata landmarks for sights and museums) → one
 * category entry: places inside the city radius, Wikipedia counts for
 * sights, honest ranking, at most 40 sights or museums and 30 of the rest,
 * slimmed for storage. Sights keep their Wikidata kinds; the candidates the
 * sight rules leave out (rules.ts) are stored too, so rules apply on read.
 */
export async function buildCategoryEntry(
  city: Destination,
  category: CategoryId,
  elements: readonly OverpassElement[],
  { fetcher, landmarks, kinds, overrides, cocktailBars = [], retry = (_label, task) => task() }: BuildOptions = {},
): Promise<{ places: StoredPlace[]; wikipediaCountsAvailable: boolean }> {
  const osm = elements
    .map((e) => toPlace(e, category))
    .filter((p) => p !== null)
    // Queries use a bounding box; keep only what is inside the city radius.
    .filter((p) => distanceKm(city.lat, city.lon, p.lat, p.lon) <= city.radiusKm)
    .map((p) => {
      const qid = landmarks?.qidFor.get(p.id);
      const country = landmarks?.countryFor.get(p.id);
      return { ...p, ...(qid && !p.wikidataId ? { wikidataId: qid } : {}), ...(country ? { country } : {}) };
    });
  const moved = new Set(cocktailBars.map((p) => p.id));
  // Landmarks were already limited to the radius, or twice it when very well known.
  const places = [
    ...(category === "pub" ? osm.filter((p) => !moved.has(p.id)) : osm),
    ...(category === "cocktail" ? cocktailBars.filter((p) => !osm.some((o) => o.id === p.id)) : []),
    ...(landmarks?.extras.filter((p) => p.category === category) ?? []),
  ]
    .map((p): Place => {
      const tags = p.wikidataId ? kinds?.get(p.wikidataId) : undefined;
      return tags?.length ? { ...p, kinds: [...tags] } : p;
    });

  let counts: Map<string, number> | undefined;
  let wikipediaCountsAvailable = CATEGORIES[category].ranking !== "wikipedia";
  if (CATEGORIES[category].ranking === "wikipedia") {
    const known = landmarks?.counts ?? new Map<string, number>();
    const ids = places.flatMap((p) => (p.wikidataId && !known.has(p.wikidataId) ? [p.wikidataId] : []));
    try {
      const fetched = await retry(`${city.cityCode}/${category} wikidata`, () => fetchWikipediaCounts(ids, { fetcher }));
      counts = new Map([...known, ...fetched]);
      wikipediaCountsAvailable = true;
    } catch {
      wikipediaCountsAvailable = false;
    }
  }
  // Keep the top 40 (or 30) that pass today's sight rules, and the candidates they leave out in between.
  const ranked = rankPlaces(places, category, counts, {
    counts: (p) => CATEGORIES[category].ranking !== "wikipedia" || isSight(p, category, overrides),
    maxStored: MAX_STORED_PER_CATEGORY,
  });
  return { places: ranked.map(slimPlace), wikipediaCountsAvailable };
}
