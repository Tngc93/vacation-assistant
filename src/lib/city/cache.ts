import { cacheLife, cacheTag } from "next/cache";
import { fetchCityPhoto, type CityPhoto } from "./photo";

/** City photo with attribution, shared across instances for about a month. Errors are not cached. */
export async function getCityPhoto(wikidataId: string): Promise<CityPhoto | null> {
  "use cache: remote";
  cacheTag(`photo:${wikidataId}`);
  cacheLife({ stale: 24 * 3600, revalidate: 30 * 24 * 3600, expire: 60 * 24 * 3600 });
  return fetchCityPhoto(wikidataId);
}
