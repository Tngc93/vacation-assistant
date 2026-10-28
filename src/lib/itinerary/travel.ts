import { distanceKm } from "@/lib/geo";
import { ITINERARY } from "./config";
import { roundUp } from "./time";

export type Travel = {
  km: number;
  /** Walking estimate, rounded up to 5 minutes. */
  walkMin: number;
  /** Over 3 km: public transport or a taxi is suggested. */
  transit: boolean;
  /** Time the schedule allows: the walk, or the transit allowance over 3 km. */
  scheduledMin: number;
};

type Point = { lat: number; lon: number };

/** The walking rule: over 3 km (straight line), public transport or a taxi is suggested. */
export const needsTransit = (km: number): boolean => km > ITINERARY.transitKm;

/** Straight-line distance × 1.3 detour ÷ 4.5 km/h. */
export function travelBetween(a: Point, b: Point): Travel {
  const km = distanceKm(a.lat, a.lon, b.lat, b.lon);
  const walkMin = Math.max(ITINERARY.roundMin, roundUp(((km * ITINERARY.walkDetour) / ITINERARY.walkKmh) * 60));
  const transit = needsTransit(km);
  return { km, walkMin, transit, scheduledMin: transit ? Math.min(walkMin, ITINERARY.transitMin) : walkMin };
}
