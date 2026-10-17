import type { Destination } from "@/data/destinations";
import { CATEGORIES, type CategoryId } from "./categories";
import type { StoredPlace } from "./file";
import { distanceKm, type Fetcher, type OverpassElement } from "./overpass";
import { toPlace } from "./place";
import { rankPlaces, type RankedPlace } from "./rank";
import { fetchWikipediaCounts } from "./wikidata";

const round5 = (n: number) => Number(n.toFixed(5));

/** Keeps only what the UI shows: no category (the file key), no Wikidata ID, 5-decimal coordinates. */
export function slimPlace(place: RankedPlace): StoredPlace {
  const { category, wikidataId, ...rest } = place;
  return { ...rest, lat: round5(place.lat), lon: round5(place.lon) };
}

export type BuildOptions = {
  fetcher?: Fetcher;
  /** Wraps the Wikidata call (the data script adds retries and back-off). */
  retry?: <T>(label: string, task: () => Promise<T>) => Promise<T>;
};

/**
 * Overpass elements → one category entry: places inside the city radius,
 * Wikipedia counts for sights, honest ranking, at most 30, slimmed for storage.
 */
export async function buildCategoryEntry(
  city: Destination,
  category: CategoryId,
  elements: readonly OverpassElement[],
  { fetcher, retry = (_label, task) => task() }: BuildOptions = {},
): Promise<{ places: StoredPlace[]; wikipediaCountsAvailable: boolean }> {
  const places = elements
    .map((e) => toPlace(e, category))
    .filter((p) => p !== null)
    // Queries use a bounding box; keep only what is inside the city radius.
    .filter((p) => distanceKm(city.lat, city.lon, p.lat, p.lon) <= city.radiusKm);

  let counts: Map<string, number> | undefined;
  let wikipediaCountsAvailable = CATEGORIES[category].ranking !== "wikipedia";
  if (CATEGORIES[category].ranking === "wikipedia") {
    const ids = places.flatMap((p) => (p.wikidataId ? [p.wikidataId] : []));
    try {
      counts = await retry(`${city.cityCode}/${category} wikidata`, () => fetchWikipediaCounts(ids, { fetcher }));
      wikipediaCountsAvailable = true;
    } catch {
      wikipediaCountsAvailable = false;
    }
  }
  return { places: rankPlaces(places, category, counts).map(slimPlace), wikipediaCountsAvailable };
}
