import { isCategoryId, type CategoryId } from "./categories";

/** Cache identity of a city + category; also used as the revalidation tag. */
export function placesCacheKey(cityCode: string, category: CategoryId): string {
  if (!/^[A-Za-z]{3}$/.test(cityCode) || !isCategoryId(category)) throw new Error("Invalid places cache key");
  return `places:${cityCode.toUpperCase()}:${category}`;
}
