import type { I18n } from "@/i18n/i18n";
import { distanceKm } from "@/lib/geo";
import { needsTransit } from "@/lib/itinerary/travel";

type Point = { lat: number; lon: number };

/** Never "far" within this distance of the centre, however small the city's radius (the Eiffel Tower is 4.2 km out). */
export const FAR_MIN_KM = 5;

/**
 * The one rule for "far from the centre": a place whose straight-line distance from the city's centre
 * (destinations.ts `cityCentre`) is greater than the city's data radius (`radiusKm` in its places file) or
 * `FAR_MIN_KM`, whichever is larger. A place exactly at that distance is not far. Returns the distance in km for a
 * far place, else null.
 */
export function farFromCentreKm(place: Point, centre: Point, radiusKm: number): number | null {
  const km = distanceKm(centre.lat, centre.lon, place.lat, place.lon);
  return km > Math.max(radiusKm, FAR_MIN_KM) ? km : null;
}

/** "MERKEZE ~5 KM" ("~5 KM FROM CENTRE"): the same caption on the carousel card, the place details and the plan's stop. */
export function farCaption(km: number, { m, f }: Pick<I18n, "m" | "f">): string {
  return f(m.places.farFromCentre, { km: Math.max(1, Math.round(km)) });
}

/** Shown where the plan's walking rule (travel.ts) says it is too far to walk: messages `places.transit`. */

/** From the centre, by the plan's walking rule (travel.ts): public transport or a taxi when it is too far to walk. */
export const transitFromCentre = (km: number): boolean => needsTransit(km);
