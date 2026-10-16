import { findDestination } from "@/data/destinations";
import { CATEGORIES, type CategoryId } from "./categories";
import { buildOverpassQuery, distanceKm, runOverpass, type Fetcher } from "./overpass";
import { toPlace } from "./place";
import { rankPlaces, type RankedPlace } from "./rank";
import { fetchWikipediaCounts } from "./wikidata";

export type CategoryPlaces = {
  cityCode: string;
  category: CategoryId;
  places: RankedPlace[];
  /** False when Wikipedia counts could not be fetched; the order then falls back to detail and name. */
  wikipediaCountsAvailable: boolean;
};

export type LoadOptions = { fetcher?: Fetcher; overpassTimeoutMs?: number; wikidataTimeoutMs?: number };

/**
 * Overpass → places → (Wikipedia counts) → ranked top 30. Throws when Overpass
 * fails on every endpoint, so a failure is never cached as an empty list.
 */
export async function loadCategory(cityCode: string, category: CategoryId, options: LoadOptions = {}): Promise<CategoryPlaces> {
  const city = findDestination(cityCode);
  if (!city) throw new Error(`Unknown city ${cityCode}`);

  const query = buildOverpassQuery(category, city.lat, city.lon, city.radiusKm);
  const elements = await runOverpass(query, { fetcher: options.fetcher, timeoutMs: options.overpassTimeoutMs });
  const places = elements
    .map((e) => toPlace(e, category))
    .filter((p) => p !== null)
    // The query uses a bounding box; keep only what is inside the city radius.
    .filter((p) => distanceKm(city.lat, city.lon, p.lat, p.lon) <= city.radiusKm);

  let counts: Map<string, number> | undefined;
  let wikipediaCountsAvailable = CATEGORIES[category].ranking !== "wikipedia";
  if (CATEGORIES[category].ranking === "wikipedia") {
    try {
      counts = await fetchWikipediaCounts(
        places.flatMap((p) => (p.wikidataId ? [p.wikidataId] : [])),
        { fetcher: options.fetcher, timeoutMs: options.wikidataTimeoutMs },
      );
      wikipediaCountsAvailable = true;
    } catch {
      wikipediaCountsAvailable = false;
    }
  }

  return { cityCode: city.cityCode, category, places: rankPlaces(places, category, counts), wikipediaCountsAvailable };
}
