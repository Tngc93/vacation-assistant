import { PLACE_OVERRIDES, type CityOverrides } from "@/data/place-overrides";
import { CATEGORIES, type CategoryId } from "./categories";
import type { PlacesFile, StoredPlace } from "./file";
import { HERITAGE_TAG, UNESCO_TAG, type KindTag } from "./kinds";
import { categoryCap } from "./rank";

/**
 * Which stored places count as sights, applied when the files are read (the
 * guide and the plan) and by the data script to decide how many to keep.
 * The files hold the raw candidates with their kinds (kinds.ts), so a rule
 * change here needs no refetch.
 */

/** Never sights: countries and states (Vatican City itself; its sights stay)… */
const NEVER: readonly KindTag[] = ["country"];
/**
 * …and districts (Ciutat Vella, HafenCity), unless also a building or ruins: Wikidata's class tree files
 * the Eiffel Tower and the Château de Vincennes under "administrative territorial entity" too.
 */
const DISTRICT: readonly KindTag[] = ["adminArea"];
const BUILT: readonly KindTag[] = ["tower", "castle", "palace", "ruins", "museum", "religious"];
/** Not sights when only Wikidata suggests them (OSM's own tourist tag keeps La Rambla, Camp Nou): stations, hotels, streets… */
const NOT_SIGHTS: readonly KindTag[] = [
  "sportsVenue",
  "station",
  "port",
  "airport",
  "hotel",
  "racetrack",
  "street",
  "road",
  "skyscraper",
  "waterline",
  "landscape",
];
/** …and offices, firms and schools without a heritage listing (the Gazi Husrev-beg Madrasa is listed, and stays). */
const NOT_SIGHTS_UNLISTED: readonly KindTag[] = ["office", "business", "school", "university"];
/** …unless also one of these, or World Heritage (the Colosseum is a stadium and ruins; an opera house is also its company). */
const ALWAYS: readonly KindTag[] = ["museum", "ruins", "attraction", "opera", UNESCO_TAG];
/** Never sights, whatever their listing: nightclubs and cinemas. */
const NIGHT: readonly KindTag[] = ["nightclub", "cinema"];
/** Concert halls, music venues and theatres are sights only with a heritage listing (Royal Albert Hall, Musikverein)… */
const STAGE: readonly KindTag[] = ["concertHall", "musicVenue", "theatre", "performingArts"];
/** …or when they are also one of these: Palais Garnier, the Odeon of Herodes Atticus. */
const STAGE_OK: readonly KindTag[] = [HERITAGE_TAG, UNESCO_TAG, "opera", "museum", "ruins", "tower"];
/** Walked along or across rather than visited: the Champs-Élysées, Charles Bridge, Piazza Navona… */
const WALK: readonly KindTag[] = ["street", "square", "bridge", "promenade"];
/** …but not the Roman Forum (a square, and ruins) or a palace on a square. */
const WALK_EXEMPT: readonly KindTag[] = ["ruins", "palace", "castle", "museum", "religious"];

type RulePlace = Pick<StoredPlace, "id" | "wikidataId" | "kinds">;

const hasAny = (place: RulePlace, tags: readonly KindTag[]) => (place.kinds ?? []).some((k) => tags.includes(k as KindTag));
const listed = (list: CityOverrides["include"], qid: string | undefined) => Boolean(qid && list?.some((o) => o.qid === qid));

/** Whether a stored sight, museum or viewpoint is shown. Overrides come first. */
export function isSight(place: RulePlace, category: CategoryId, overrides: CityOverrides = {}): boolean {
  if (listed(overrides.exclude, place.wikidataId)) return false;
  if (listed(overrides.include, place.wikidataId)) return true;
  if (hasAny(place, NEVER)) return false;
  if (hasAny(place, DISTRICT) && !hasAny(place, BUILT)) return false;
  if (place.id.startsWith("wikidata/") && !hasAny(place, ALWAYS)) {
    if (hasAny(place, NOT_SIGHTS)) return false;
    if (hasAny(place, NOT_SIGHTS_UNLISTED) && !hasAny(place, [HERITAGE_TAG])) return false;
  }
  // A museum (OSM's museum tag or Wikidata's) that hosts concerts or films stays a museum.
  if (category === "museum") return true;
  if (hasAny(place, NIGHT)) return false;
  if (hasAny(place, STAGE) && !hasAny(place, STAGE_OK)) return false;
  return true;
}

/** Streets, squares, bridges and promenades: a short visit in the plan. */
export function isWalkThrough(place: RulePlace): boolean {
  return hasAny(place, WALK) && !hasAny(place, WALK_EXEMPT);
}

/** A place as the guide and the plan see it: no raw kinds, a walk-through flag instead. */
export type ShownPlace = Omit<StoredPlace, "kinds"> & {
  walkThrough?: true;
  /** Visit length set by an override (place-overrides.ts). */
  visitMin?: number;
};
export type ShownCategory =
  | { status: "ok"; wikipediaCountsAvailable: boolean; places: ShownPlace[] }
  | Extract<PlacesFile["categories"][CategoryId], { status: "missing" }>;
export type ShownPlacesFile = Omit<PlacesFile, "categories"> & { categories: Record<CategoryId, ShownCategory> };

function toShown(place: StoredPlace, overrides: CityOverrides): ShownPlace {
  const { kinds: _kinds, ...rest } = place;
  const visitMin = overrides.include?.find((o) => o.qid === place.wikidataId)?.visitMin;
  return { ...rest, ...(isWalkThrough(place) ? { walkThrough: true } : {}), ...(visitMin ? { visitMin } : {}) };
}

/** Applies the sight rules and the city's overrides, then the per-category limit (40 sights or museums, 30 others). */
export function applyPlaceRules(file: PlacesFile, overrides: CityOverrides = PLACE_OVERRIDES[file.cityCode] ?? {}): ShownPlacesFile {
  const categories = {} as Record<CategoryId, ShownCategory>;
  for (const [id, entry] of Object.entries(file.categories) as Array<[CategoryId, PlacesFile["categories"][CategoryId]]>) {
    if (entry.status !== "ok") {
      categories[id] = entry;
      continue;
    }
    const kept = CATEGORIES[id].ranking === "wikipedia" ? entry.places.filter((p) => isSight(p, id, overrides)) : entry.places;
    categories[id] = { ...entry, places: kept.slice(0, categoryCap(id)).map((p) => toShown(p, overrides)) };
  }
  return { ...file, categories };
}
