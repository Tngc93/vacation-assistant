/**
 * The single source of truth for city-guide categories: the URL id, the
 * Turkish label, the Overpass filters and how places are ranked.
 */

export type OsmTags = Record<string, string | undefined>;

export const CATEGORY_IDS = ["see", "museum", "viewpoint", "restaurant", "cafe", "cocktail", "pub", "club"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const DEFAULT_CATEGORIES: readonly CategoryId[] = ["see", "museum", "restaurant"];

/** How a category is ordered: by Wikipedia language count, or by how detailed the OSM record is. */
export type Ranking = "wikipedia" | "detail";

export type Category = {
  id: CategoryId;
  label: string;
  /**
   * Overpass tag filters; each becomes one `nwr…(around)` statement. Exact
   * key=value pairs only: regex filters cannot use Overpass's index and time
   * out on a busy server.
   */
  filters: readonly string[];
  ranking: Ranking;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  see: {
    id: "see",
    label: "Görülecek yer",
    filters: [
      '["tourism"="attraction"]',
      '["historic"="monument"]',
      '["historic"="castle"]',
      '["historic"="ruins"]',
      '["historic"="archaeological_site"]',
    ],
    ranking: "wikipedia",
  },
  museum: {
    id: "museum",
    label: "Müze",
    filters: ['["tourism"="museum"]', '["tourism"="gallery"]'],
    ranking: "wikipedia",
  },
  viewpoint: { id: "viewpoint", label: "Manzara noktası", filters: ['["tourism"="viewpoint"]'], ranking: "wikipedia" },
  restaurant: { id: "restaurant", label: "Restoran", filters: ['["amenity"="restaurant"]'], ranking: "detail" },
  cafe: { id: "cafe", label: "Kafe", filters: ['["amenity"="cafe"]'], ranking: "detail" },
  cocktail: {
    id: "cocktail",
    label: "Kokteyl bar",
    filters: [
      '["amenity"="bar"]["cocktails"="yes"]',
      '["amenity"="bar"]["bar"="cocktail"]',
      '["amenity"="bar"]["drink:cocktail"="yes"]',
    ],
    ranking: "detail",
  },
  pub: { id: "pub", label: "Bar ve pub", filters: ['["amenity"="bar"]', '["amenity"="pub"]'], ranking: "detail" },
  club: { id: "club", label: "Gece kulübü", filters: ['["amenity"="nightclub"]'], ranking: "detail" },
};

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

/** A bar tagged as serving cocktails. */
export function isCocktailBar(tags: OsmTags): boolean {
  return (
    tags.amenity === "bar" && (tags.cocktails === "yes" || tags.bar === "cocktail" || tags["drink:cocktail"] === "yes")
  );
}

/**
 * Categories a set of OSM tags belongs to. Mirrors the Overpass filters so
 * results can be checked locally; cocktail bars are kept out of "Bar ve pub".
 */
export function classify(tags: OsmTags): CategoryId[] {
  const found: CategoryId[] = [];
  if (tags.tourism === "attraction" || /^(monument|castle|ruins|archaeological_site)$/.test(tags.historic ?? "")) {
    found.push("see");
  }
  if (tags.tourism === "museum" || tags.tourism === "gallery") found.push("museum");
  if (tags.tourism === "viewpoint") found.push("viewpoint");
  if (tags.amenity === "restaurant") found.push("restaurant");
  if (tags.amenity === "cafe") found.push("cafe");
  if (isCocktailBar(tags)) found.push("cocktail");
  else if (tags.amenity === "bar" || tags.amenity === "pub") found.push("pub");
  if (tags.amenity === "nightclub") found.push("club");
  return found;
}
