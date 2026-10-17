import type { CategoryId } from "@/lib/places/categories";

/**
 * Every number the day-by-day plan uses, in one place. Times are minutes from
 * midnight in the destination's time zone.
 */
export const ITINERARY = {
  /** From landing to the first stop: airport to city and checking in. */
  arrivalBufferMin: 120,
  /** From the last stop to the return flight's departure. */
  departureBufferMin: 210,
  /** Without a chosen flight, the first day starts and the last day ends here ("half day"). */
  halfDaySplit: 13 * 60,

  /** Daytime stops fit between these times on a full day. */
  dayStart: 9 * 60,
  daytimeEnd: 18 * 60 + 30,
  /** The evening place starts at this time. */
  eveningStart: 19 * 60 + 30,

  /** Limits for a full day; shorter days get proportionally fewer daytime stops. */
  maxDaytimeStops: 4,
  maxEveningStops: 1,

  /** Visit length per category. */
  visitMin: { museum: 120, see: 60, viewpoint: 30, evening: 120 } satisfies Record<"museum" | "see" | "viewpoint" | "evening", number>,

  /** Walking estimate: straight-line distance × detour factor at walking speed. */
  walkDetour: 1.3,
  walkKmh: 4.5,
  /** Above this straight-line distance the plan suggests public transport or a taxi… */
  transitKm: 3,
  /** …and schedules this much time for the trip instead of the walk. */
  transitMin: 30,
  /** Times are shown and scheduled in steps of this many minutes. */
  roundMin: 5,

  /** Anchors (each day's most important stop) are at least this far apart; halved when the city is too small. */
  anchorMinKm: 1.2,
  /**
   * OSM often maps one place as several objects (La Rambla in Barcelona is nine ways). Places with the
   * same name within this distance count as one.
   */
  sameNameKm: 1,
  /** The evening place: the best ranked one within this distance of the last stop, else the nearest. */
  eveningRadiusKm: 1.5,
} as const;

/** Daytime stops come from these categories, in this order of preference on ties. */
export const DAYTIME_CATEGORIES = ["see", "museum", "viewpoint"] as const satisfies readonly CategoryId[];
/** The evening place comes from the user's chosen chips among these; restaurant when none is chosen. */
export const EVENING_CATEGORIES = ["restaurant", "cocktail", "pub", "club"] as const satisfies readonly CategoryId[];
export type DaytimeCategory = (typeof DAYTIME_CATEGORIES)[number];
export type EveningCategory = (typeof EVENING_CATEGORIES)[number];

export function eveningCategoriesFor(selected: readonly CategoryId[]): EveningCategory[] {
  const chosen = EVENING_CATEGORIES.filter((c) => selected.includes(c));
  return chosen.length ? chosen : ["restaurant"];
}
