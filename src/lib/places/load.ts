import "server-only";
import { cache } from "react";
import { placesFileSchema } from "./file";
import { applyPlaceRules, type ShownPlacesFile } from "./rules";

/**
 * Reads src/data/places/<CODE>.json on the server. Never queries Overpass,
 * Wikidata or Commons; a missing or invalid file simply means "no data yet".
 * The sight rules and the city's overrides are applied here (rules.ts), for
 * the guide and the plan alike.
 */
export const loadPlacesFile = cache(async (cityCode: string): Promise<ShownPlacesFile | null> => {
  const code = cityCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    const mod = (await import(`../../data/places/${code}.json`)) as { default: unknown };
    const parsed = placesFileSchema.safeParse(mod.default);
    return parsed.success ? applyPlaceRules(parsed.data) : null;
  } catch {
    return null;
  }
});
