// geo, not overpass: the day-by-day plan uses this rule in the browser too.
import { distanceKm } from "@/lib/geo";

/**
 * OSM often maps one place as several objects (Barcelona's La Rambla is nine
 * ways). Two places with the same name this close together count as one.
 */
export const SAME_NAME_KM = 1;

type Locatable = { id: string; name: string; lat: number; lon: number; wikidataId?: string };

/** Case- and whitespace-insensitive name, lowercased with Turkish rules. */
export const nameKey = (p: Locatable) => p.name.toLocaleLowerCase("tr").normalize("NFC").replace(/\s+/g, " ").trim();

/**
 * One entry per place, in the given order: the same OSM id twice, the same
 * Wikidata item twice (Forum Romanum and "Piazza del Foro" both point to
 * Q180212), or the same name within `SAME_NAME_KM` (one place mapped as
 * several objects), keeps the first.
 */
export function sameNameOnce<T extends Locatable>(places: readonly T[]): T[] {
  const kept: T[] = [];
  const ids = new Set<string>();
  for (const p of places) {
    if (ids.has(p.id) || (p.wikidataId && ids.has(p.wikidataId))) continue;
    ids.add(p.id);
    if (p.wikidataId) ids.add(p.wikidataId);
    const key = nameKey(p);
    if (kept.some((k) => nameKey(k) === key && distanceKm(k.lat, k.lon, p.lat, p.lon) <= SAME_NAME_KM)) continue;
    kept.push(p);
  }
  return kept;
}
