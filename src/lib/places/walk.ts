import type { I18n } from "@/i18n/i18n";
import { travelBetween } from "@/lib/itinerary/travel";

type Point = { lat: number; lon: number };

/** Walking up to this long reads as a walk; beyond it the card gives the distance. */
const MAX_WALK_MIN = 60;

/**
 * "MERKEZE 15 DK YÜRÜME" or, for a long way out, "MERKEZE 7,4 KM" ("15 MIN WALK TO CENTRE", "7.4 KM FROM CENTRE"):
 * the same estimate as the day plan.
 */
export function walkToCentre(place: Point, centre: Point, { intl, m, f }: Pick<I18n, "intl" | "m" | "f">): string {
  const travel = travelBetween(centre, place);
  return travel.walkMin <= MAX_WALK_MIN
    ? f(m.places.walkToCentre, { min: travel.walkMin })
    : f(m.places.kmFromCentre, { km: new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(travel.km) });
}
