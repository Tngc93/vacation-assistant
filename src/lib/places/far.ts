import { distanceKm } from "@/lib/geo";
import { needsTransit } from "@/lib/itinerary/travel";

type Point = { lat: number; lon: number };

/**
 * The one rule for "far from the centre": a place whose straight-line distance from the city's centre
 * (destinations.ts) is greater than the city's data radius (`radiusKm` in its places file). A place exactly at
 * the radius is not far. Returns that distance in km for a far place, else null.
 */
export function farFromCentreKm(place: Point, centre: Point, radiusKm: number): number | null {
  const km = distanceKm(centre.lat, centre.lon, place.lat, place.lon);
  return km > radiusKm ? km : null;
}

/** "MERKEZE UZAK · ~5 KM": the same caption on the carousel card, the place details and the plan's stop. */
export function farCaption(km: number): string {
  return `MERKEZE UZAK · ~${Math.max(1, Math.round(km))} KM`;
}

/** Shown where the plan's walking rule (travel.ts) says it is too far to walk. */
export const TRANSIT_CAPTION = "TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR";

/** From the centre, by the plan's walking rule (travel.ts): public transport or a taxi when it is too far to walk. */
export const transitFromCentre = (km: number): boolean => needsTransit(km);
