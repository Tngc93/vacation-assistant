import { cacheLife, cacheTag } from "next/cache";
import type { CategoryId } from "./categories";
import { placesCacheKey } from "./keys";
import { loadCategory, type CategoryPlaces } from "./loadCategory";

/**
 * Shared across users, requests and server instances ("use cache: remote")
 * for about a week, keyed only by city and category, so Overpass sees at most
 * one query per pair per week. A thrown error is never cached; a result
 * without Wikipedia counts is kept for an hour only, then retried.
 */
export async function getCategoryPlaces(cityCode: string, category: CategoryId): Promise<CategoryPlaces> {
  "use cache: remote";
  cacheTag(placesCacheKey(cityCode, category));
  const result = await loadCategory(cityCode.toUpperCase(), category);
  cacheLife(
    result.wikipediaCountsAvailable
      ? { stale: 3600, revalidate: 7 * 24 * 3600, expire: 14 * 24 * 3600 }
      : { stale: 300, revalidate: 3600, expire: 24 * 3600 },
  );
  return result;
}
