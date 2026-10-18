import { CATEGORIES, type CategoryId } from "./categories";
import type { Place } from "./place";
import { sameNameOnce } from "./twins";

export const MAX_PLACES_PER_CATEGORY = 30;
/** Sights and museums hold more: they feed the trip's must-see list. */
export const MAX_SIGHTS_PER_CATEGORY = 40;
export const categoryCap = (category: CategoryId) =>
  category === "see" || category === "museum" ? MAX_SIGHTS_PER_CATEGORY : MAX_PLACES_PER_CATEGORY;

/** A place as shown, with the honest reason for its position. */
export type RankedPlace = Place & {
  /** Wikipedia language editions with an article (sights, museums, viewpoints). */
  wikipediaCount?: number;
  /** True when OSM records a website, opening hours and/or cuisine (at least two). */
  detailed?: true;
};

const collator = new Intl.Collator("tr");

/** How many of website, opening hours and cuisine the OSM record has. */
export function detailScore(place: Place): number {
  return [place.website, place.openingHours, place.cuisine].filter(Boolean).length;
}

/**
 * Orders places without pretending to know quality:
 * - sights, museums, viewpoints: by Wikipedia language count (if known), then detail;
 * - food and drink: by how detailed the OSM record is. No ratings exist, so no "best".
 * Ties fall back to the name, so the order is stable.
 * A sight mapped as several OSM objects (same name within 1 km, like the nine
 * ways of La Rambla) is kept once, at its best rank. Food and drink are not
 * merged: there the same name nearby is usually another branch of a chain.
 */
export function rankPlaces(
  places: readonly Place[],
  category: CategoryId,
  wikipediaCounts?: ReadonlyMap<string, number>,
  /**
   * The data script keeps places until this many pass the sight rules (rules.ts), so the files also hold
   * the candidates the rules leave out today: up to MAX_STORED_PER_CATEGORY in all.
   */
  { counts = () => true, maxStored = categoryCap(category) }: { counts?: (place: RankedPlace) => boolean; maxStored?: number } = {},
): RankedPlace[] {
  const seen = new Set<string>();
  const unique = places.filter((p) => !seen.has(p.id) && seen.add(p.id));

  const ranked: RankedPlace[] = unique.map((place) => {
    const count = place.wikidataId ? wikipediaCounts?.get(place.wikidataId) : undefined;
    return {
      ...place,
      ...(CATEGORIES[category].ranking === "wikipedia" && count !== undefined && count > 0 ? { wikipediaCount: count } : {}),
      ...(CATEGORIES[category].ranking === "detail" && detailScore(place) >= 2 ? { detailed: true } : {}),
    };
  });

  ranked.sort(
    (a, b) =>
      (b.wikipediaCount ?? 0) - (a.wikipediaCount ?? 0) ||
      detailScore(b) - detailScore(a) ||
      collator.compare(a.name, b.name),
  );
  const once = CATEGORIES[category].ranking === "wikipedia" ? sameNameOnce(ranked) : ranked;
  const kept: RankedPlace[] = [];
  let counted = 0;
  for (const place of once) {
    if (counted >= categoryCap(category) || kept.length >= maxStored) break;
    kept.push(place);
    if (counts(place)) counted++;
  }
  return kept;
}
