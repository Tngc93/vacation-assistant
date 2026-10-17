import "server-only";
import { cache } from "react";
import { placesFileSchema, type PlacesFile } from "./file";

/**
 * Reads src/data/places/<CODE>.json on the server. Never queries Overpass,
 * Wikidata or Commons; a missing or invalid file simply means "no data yet".
 */
export const loadPlacesFile = cache(async (cityCode: string): Promise<PlacesFile | null> => {
  const code = cityCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    const mod = (await import(`../../data/places/${code}.json`)) as { default: unknown };
    const parsed = placesFileSchema.safeParse(mod.default);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});
