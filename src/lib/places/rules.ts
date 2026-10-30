import { cityCentre, findDestination } from "@/data/destinations";
import { PLACE_OVERRIDES, type CityOverrides } from "@/data/place-overrides";
import { CATEGORIES, type CategoryId } from "./categories";
import { farFromCentreKm } from "./far";
import type { PlacesFile, StoredPlace } from "./file";
import { FAR_FROM_ITEM_TAG, HERITAGE_TAG, NO_COORDINATE_TAG, UNESCO_TAG, type KindTag } from "./kinds";
import type { Locale } from "@/i18n/locales";
import { isLatin, readableName } from "./names";
import { categoryCap, compareRanked } from "./rank";

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

/** Kinds that make an item a place we show, whatever else it is (the Louvre is an organization too). */
const SIGHT_KINDS: readonly KindTag[] = [
  "museum",
  "ruins",
  "attraction",
  "palace",
  "castle",
  "religious",
  "tower",
  "street",
  "square",
  "bridge",
  "promenade",
  "opera",
  "concertHall",
  "musicVenue",
  "theatre",
  "performingArts",
];
/** Official residences and seats of government are kept out of the plan, unless they are also a museum or ruins. */
const RESIDENCE: readonly KindTag[] = ["residence"];
const RESIDENCE_OK: readonly KindTag[] = ["museum", "ruins"];

type RulePlace = Pick<StoredPlace, "id" | "wikidataId" | "kinds">;

const hasAny = (place: RulePlace, tags: readonly KindTag[]) => (place.kinds ?? []).some((k) => tags.includes(k as KindTag));
const listed = (list: CityOverrides["include"], qid: string | undefined) => Boolean(qid && list?.some((o) => o.qid === qid));

/** Whether a stored sight, museum or viewpoint is shown. Overrides come first. */
export function isSight(place: RulePlace, category: CategoryId, overrides: CityOverrides = {}): boolean {
  if (listed(overrides.exclude, place.wikidataId)) return false;
  if (listed(overrides.include, place.wikidataId)) return true;
  // Countries and districts are judged only when Wikidata alone suggests the place: Wikidata's class tree also
  // files the Brandenburg Gate, the Kremlin and Christiania under them, and OSM's own tag says they are sights.
  const wikidataOnly = place.id.startsWith("wikidata/");
  if (wikidataOnly && hasAny(place, NEVER)) return false;
  if (wikidataOnly && hasAny(place, DISTRICT) && !hasAny(place, BUILT)) return false;
  if (wikidataOnly && !hasAny(place, ALWAYS)) {
    if (hasAny(place, NOT_SIGHTS)) return false;
    if (hasAny(place, NOT_SIGHTS_UNLISTED) && !hasAny(place, [HERITAGE_TAG])) return false;
  }
  // A museum (OSM's museum tag or Wikidata's) that hosts concerts or films stays a museum.
  if (category === "museum") return true;
  if (hasAny(place, NIGHT)) return false;
  if (hasAny(place, STAGE) && !hasAny(place, STAGE_OK)) return false;
  return true;
}

/**
 * Rule 1: an OSM object tagged with a Wikidata item that is not the place, so the item's Wikipedia count says
 * nothing about it: an item more than 2 km away; an event, person or idea without a coordinate (the Foucault
 * pendulum, Chaliapin); an organization without one, unless OSM calls the object a museum (a museum's own
 * item often has no coordinate); or a university (the Sorbonne's gallery). A relink override settles it.
 */
export function hasWrongLink(place: RulePlace, category: CategoryId, overrides: CityOverrides = {}): boolean {
  if (place.id.startsWith("wikidata/") || !place.wikidataId) return false;
  if (overrides.relink?.some((r) => r.osmId === place.id)) return false;
  if (hasAny(place, [FAR_FROM_ITEM_TAG])) return true;
  const noCoordinate = hasAny(place, [NO_COORDINATE_TAG]);
  if (noCoordinate && hasAny(place, ["notPlace"])) return true;
  if (noCoordinate && hasAny(place, ["organization"]) && category !== "museum") return true;
  return hasAny(place, ["university"]) && !hasAny(place, SIGHT_KINDS);
}

/** Rule 2: an official residence or seat of government (the Élysée, 10 Downing Street): not a plan stop. */
export function isResidence(place: RulePlace): boolean {
  return hasAny(place, RESIDENCE) && !hasAny(place, RESIDENCE_OK);
}

/** Streets, squares, bridges and promenades: a short visit in the plan. */
export function isWalkThrough(place: RulePlace): boolean {
  return hasAny(place, WALK) && !hasAny(place, WALK_EXEMPT);
}

/**
 * A place as the guide and the plan see it: no raw kinds, a walk-through flag instead; a name in the Latin script
 * when there is one (names.ts), the stored name in another script then the local name.
 */
export type ShownPlace = Omit<StoredPlace, "kinds" | "labels" | "osmNames" | "descriptionEn"> & {
  walkThrough?: true;
  /** Visit length set by an override (place-overrides.ts). */
  visitMin?: number;
  /** A residence closed to visitors: shown in the guide, never a plan stop. */
  noVisit?: true;
  /** Seen from outside only (place-overrides.ts), except in `openMonths`. */
  exterior?: { visitMin?: number; openMonths?: readonly number[]; note?: string };
  /**
   * Far from the centre (far.ts: beyond the city's data radius): the distance in km, to one decimal. A place
   * inside another shown place (`parentId`) carries that place's value, so the two never disagree.
   */
  farKm?: number;
};
export type ShownCategory =
  | { status: "ok"; wikipediaCountsAvailable: boolean; places: ShownPlace[] }
  | Extract<PlacesFile["categories"][CategoryId], { status: "missing" }>;
export type ShownPlacesFile = Omit<PlacesFile, "categories"> & { categories: Record<CategoryId, ShownCategory> };

/**
 * The name and local name shown: a `rename` override (it corrects a Turkish label, so Turkish only), else the name
 * rule of the interface language (names.ts) with the country's romanization.
 */
function shownName(
  place: StoredPlace,
  overrides: CityOverrides,
  countryCode: string | undefined,
  locale: Locale,
): { name: string; localName?: string } {
  const renamed = locale === "tr" && place.wikidataId ? overrides.rename?.find((o) => o.qid === place.wikidataId) : undefined;
  const readable = readableName(place, countryCode, locale);
  if (!renamed) return readable;
  const localName = readable.name === place.name ? place.localName : place.name;
  return { name: renamed.shownName, ...(localName && localName !== renamed.shownName ? { localName } : {}) };
}

function toShown(
  place: StoredPlace,
  overrides: CityOverrides,
  farKm: number | null,
  nameOf: ReadonlyMap<string, string>,
  countryCode: string | undefined,
  locale: Locale,
): ShownPlace {
  const {
    kinds: _kinds,
    labels: _labels,
    osmNames: _osmNames,
    name: _name,
    localName: _localName,
    description: _description,
    descriptionEn: _descriptionEn,
    ...rest
  } = place;
  // The parent's name as shown: in English always the parent's English name; in Turkish for a stored parentName in
  // another script or a renamed parent.
  const renamedParent = locale === "tr" && place.parentId ? overrides.rename?.find((o) => o.qid === place.parentId)?.shownName : undefined;
  const parentName =
    renamedParent ??
    (place.parentId && place.parentName && (locale === "en" || !isLatin(place.parentName)) ? nameOf.get(place.parentId) : undefined);
  // The description in the interface language; an English page shows none rather than a Turkish one.
  const description = locale === "en" ? place.descriptionEn : place.description;
  const qid = place.wikidataId;
  const included = qid ? overrides.include?.find((o) => o.qid === qid) : undefined;
  const visitMin = [included, ...[overrides.open, overrides.visit].map((list) => (qid ? list?.find((o) => o.qid === qid) : undefined))].find(
    (o) => o?.visitMin,
  )?.visitMin;
  const exterior = qid ? overrides.exteriorOnly?.find((o) => o.qid === qid) : undefined;
  const exteriorNote = locale === "en" ? exterior?.noteEn : exterior?.note;
  const open = Boolean(qid && overrides.open?.some((o) => o.qid === qid));
  return {
    ...shownName(place, overrides, countryCode, locale),
    ...rest,
    ...(description ? { description } : {}),
    ...(parentName ? { parentName } : {}),
    ...(isWalkThrough(place) ? { walkThrough: true } : {}),
    ...(visitMin ? { visitMin } : {}),
    ...(farKm !== null ? { farKm: Math.round(farKm * 10) / 10 } : {}),
    ...(exterior
      ? {
          exterior: {
            ...(exterior.visitMin ? { visitMin: exterior.visitMin } : {}),
            ...(exterior.openMonths ? { openMonths: exterior.openMonths } : {}),
            ...(exteriorNote ? { note: exteriorNote } : {}),
          },
        }
      : isResidence(place) && !open
        ? { noVisit: true }
        : {}),
  };
}

/** Drops the item a wrong link points at: its Wikipedia count, id and kinds belong to something else. */
function unlinked(place: StoredPlace): StoredPlace {
  const { wikidataId: _qid, wikipediaCount: _count, kinds: _kinds, labels: _labels, ...rest } = place;
  return rest;
}

/**
 * Each shown place's distance from the centre when it is far (far.ts), else null. A place inside another shown
 * place takes that place's value: the Tsar Bell is as far as the Kremlin.
 */
function farOf(kept: Iterable<StoredPlace>, centre: { lat: number; lon: number } | undefined, radiusKm: number) {
  const places = [...kept];
  const own = (p: StoredPlace) => (centre ? farFromCentreKm(p, centre, radiusKm) : null);
  const byQid = new Map(places.flatMap((p) => (p.wikidataId ? [[p.wikidataId, p] as const] : [])));
  return new Map(
    places.map((p) => {
      const parent = p.parentId ? byQid.get(p.parentId) : undefined;
      return [p.id, own(parent && parent.id !== p.id ? parent : p)] as const;
    }),
  );
}

function centreOf(cityCode: string) {
  const destination = findDestination(cityCode);
  return destination ? cityCentre(destination) : undefined;
}

/**
 * Applies the sight rules and the city's overrides, then the per-category limit (40 sights or museums, 30 others),
 * and marks the places far from the centre (far.ts; the centre is the destination's tourist centre, `cityCentre`).
 * Names in another script are romanized by the official system of the destination's country (names.ts); names and
 * descriptions follow the interface language.
 */
export function applyPlaceRules(
  file: PlacesFile,
  overrides: CityOverrides = PLACE_OVERRIDES[file.cityCode] ?? {},
  centre: { lat: number; lon: number } | undefined = centreOf(file.cityCode),
  countryCode: string | undefined = findDestination(file.cityCode)?.countryCode,
  locale: Locale = "tr",
): ShownPlacesFile {
  const kept = {} as Partial<Record<CategoryId, StoredPlace[]>>;
  for (const [id, entry] of Object.entries(file.categories) as Array<[CategoryId, PlacesFile["categories"][CategoryId]]>) {
    if (entry.status !== "ok") continue;
    let places = entry.places;
    if (CATEGORIES[id].ranking === "wikipedia") {
      const wrong = new Set(places.filter((p) => hasWrongLink(p, id, overrides)).map((p) => p.id));
      places = places.map((p) => (wrong.has(p.id) ? unlinked(p) : p)).filter((p) => isSight(p, id, overrides));
      // A place that lost a wrong link's count moves down; otherwise the stored order stands.
      if (wrong.size) places = [...places].sort(compareRanked);
    }
    kept[id] = places.slice(0, categoryCap(id));
  }
  const far = farOf(Object.values(kept).flat(), centre, file.radiusKm);
  // A parent's name as shown, for a stored parentName in another script.
  const nameOf = new Map(
    Object.values(kept)
      .flat()
      .flatMap((p) => (p.wikidataId ? [[p.wikidataId, shownName(p, overrides, countryCode, locale).name] as const] : [])),
  );
  const categories = {} as Record<CategoryId, ShownCategory>;
  for (const [id, entry] of Object.entries(file.categories) as Array<[CategoryId, PlacesFile["categories"][CategoryId]]>) {
    const places = kept[id];
    categories[id] = entry.status === "ok" && places ? { ...entry, places: places.map((p) => toShown(p, overrides, far.get(p.id) ?? null, nameOf, countryCode, locale)) } : entry;
  }
  return { ...file, categories };
}
