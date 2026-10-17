import { CATEGORY_IDS, DEFAULT_CATEGORIES, isCategoryId, type CategoryId } from "./categories";

/**
 * Reads `cats` from the URL. Missing → the defaults; unknown ids are dropped;
 * the result is deduplicated and in canonical order. An explicitly empty
 * `cats=` means the user turned everything off.
 */
export function parseCategories(raw: string | string[] | null | undefined): CategoryId[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) return [...DEFAULT_CATEGORIES];
  const wanted = new Set(value.split(",").map((v) => v.trim().toLowerCase()).filter(isCategoryId));
  return CATEGORY_IDS.filter((id) => wanted.has(id));
}

/** Writes categories in canonical order ("see,museum,cocktail"). */
export function serializeCategories(categories: readonly CategoryId[]): string {
  const wanted = new Set(categories);
  return CATEGORY_IDS.filter((id) => wanted.has(id)).join(",");
}

export function toggleCategory(categories: readonly CategoryId[], id: CategoryId): CategoryId[] {
  const next = new Set(categories);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return CATEGORY_IDS.filter((c) => next.has(c));
}
