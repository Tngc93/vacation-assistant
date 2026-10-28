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

/**
 * The events chip's token in `?cats=`. Events are not a place category (they come from src/data/events/, not the
 * places file), so the token is read and written beside the categories, after them.
 */
export const EVENTS_TOKEN = "event";

/** Events are shown when `?cats=` is missing (the default) or lists "event". */
export function parseShowEvents(raw: string | string[] | null | undefined): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) return true;
  return value.split(",").some((v) => v.trim().toLowerCase() === EVENTS_TOKEN);
}

/** The categories and, when shown, the events token last ("see,museum,event"). */
export function serializeCats(categories: readonly CategoryId[], showEvents: boolean): string {
  return [serializeCategories(categories), showEvents ? EVENTS_TOKEN : ""].filter(Boolean).join(",");
}
