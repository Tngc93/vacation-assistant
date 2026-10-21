import { travelBetween } from "@/lib/itinerary/travel";

type Point = { lat: number; lon: number };

/** Walking up to this long reads as a walk; beyond it the card gives the distance. */
const MAX_WALK_MIN = 60;

const km = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

/** "MERKEZE 15 DK YÜRÜME" or, for a long way out, "MERKEZE 7,4 KM": the same estimate as the day plan. */
export function walkToCentre(place: Point, centre: Point): string {
  const travel = travelBetween(centre, place);
  return travel.walkMin <= MAX_WALK_MIN ? `MERKEZE ${travel.walkMin} DK YÜRÜME` : `MERKEZE ${km.format(travel.km)} KM`;
}
