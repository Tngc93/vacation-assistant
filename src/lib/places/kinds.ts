/**
 * Kinds of sights, from their Wikidata types (P31 with all subclasses) and
 * heritage designations (P1435). The data script stores a place's kinds as
 * these short tags, only for the classes the rules below use, so the files
 * stay small; the rules themselves run when the files are read (rules.ts),
 * and changing them needs no refetch.
 */
export const KIND_CLASSES = {
  Q33506: "museum",
  Q839954: "ruins",
  Q570116: "attraction",
  Q16560: "palace",
  Q23413: "castle",
  Q24398318: "religious",
  Q12518: "tower",

  Q79007: "street",
  Q62685721: "street",
  Q174782: "square",
  Q12280: "bridge",
  Q787113: "promenade",
  Q88372: "promenade",

  Q1060829: "concertHall",
  Q8719053: "musicVenue",
  Q1684522: "musicVenue",
  Q24354: "theatre",
  Q57660343: "performingArts",
  Q153562: "opera",
  Q622425: "nightclub",
  Q1228895: "nightclub",
  Q41253: "cinema",

  Q1076486: "sportsVenue",
  Q55488: "station",
  Q12819564: "station",
  Q719456: "station",
  Q928830: "station",
  Q44782: "port",
  Q1248784: "airport",
  Q27686: "hotel",
  Q2338524: "racetrack",
  Q34442: "road",
  Q11303: "skyscraper",
  Q1021645: "office",
  Q4830453: "business",
  Q3914: "school",
  Q3918: "university",
  Q2923447: "waterline",
  Q3116860: "landscape",

  // Not places: a sight linked to one of these (without a coordinate) is linked to the wrong item (rules.ts).
  Q43229: "organization",
  Q5: "notPlace",
  Q1190554: "notPlace",
  Q483247: "notPlace",
  Q151885: "notPlace",
  Q7184903: "notPlace",
  Q38723: "university",
  // Official residences and seats of government: usually closed to visitors (the Élysée, 10 Downing Street).
  Q481289: "residence",
  Q1901835: "residence",

  Q56061: "adminArea",
  Q6256: "country",
  Q3624078: "country",
  Q133442: "country",
} as const;

/**
 * About the link, not the item: the OSM object's Wikidata item has no coordinate, or none within 2 km of the
 * object (Doha Port linked 585 km away). Set by the data script for OSM places only.
 */
export const NO_COORDINATE_TAG = "noCoordinate";
export const FAR_FROM_ITEM_TAG = "farFromItem";
export const LINK_FAR_KM = 2;

/** Any heritage designation (P1435), and World Heritage (P1435 = Q9259). */
export const HERITAGE_TAG = "heritage";
export const UNESCO_TAG = "unesco";
export const WORLD_HERITAGE_QID = "Q9259";

export const KIND_TAGS = [
  ...new Set([...Object.values(KIND_CLASSES), HERITAGE_TAG, UNESCO_TAG, NO_COORDINATE_TAG, FAR_FROM_ITEM_TAG]),
] as [string, ...string[]];
export type KindTag =
  | (typeof KIND_CLASSES)[keyof typeof KIND_CLASSES]
  | typeof HERITAGE_TAG
  | typeof UNESCO_TAG
  | typeof NO_COORDINATE_TAG
  | typeof FAR_FROM_ITEM_TAG;

/**
 * Link tags for an OSM object from its item's coordinates: none, or none within 2 km. `coords` undefined means
 * unknown (the query failed), and gives no tag.
 */
export function linkTags(
  place: { id: string; lat: number; lon: number },
  coords: ReadonlyArray<{ lat: number; lon: number }> | undefined,
  distanceKm: (aLat: number, aLon: number, bLat: number, bLon: number) => number,
): KindTag[] {
  if (place.id.startsWith("wikidata/") || coords === undefined) return [];
  if (coords.length === 0) return [NO_COORDINATE_TAG];
  return Math.min(...coords.map((c) => distanceKm(place.lat, place.lon, c.lat, c.lon))) > LINK_FAR_KM ? [FAR_FROM_ITEM_TAG] : [];
}
