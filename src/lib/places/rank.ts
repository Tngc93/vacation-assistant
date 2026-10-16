import { CATEGORIES, type CategoryId } from "./categories";
import type { Place } from "./place";

export const MAX_PLACES_PER_CATEGORY = 30;

/** A place as shown, with the honest reason for its position. */
export type RankedPlace = Place & {
  /** Wikipedia language editions with an article (sights, museums, viewpoints). */
  wikipediaCount?: number;
  /** True when OSM records a website, opening hours and/or cuisine (at least two). */
  detailed?: boolean;
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
 */
export function rankPlaces(
  places: readonly Place[],
  category: CategoryId,
  wikipediaCounts?: ReadonlyMap<string, number>,
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
  return ranked.slice(0, MAX_PLACES_PER_CATEGORY);
}
