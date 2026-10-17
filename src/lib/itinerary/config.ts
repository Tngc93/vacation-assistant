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

  /** Daytime stops fill the time between these, however many fit (up to `maxDaytimeStops`). */
  dayStart: 9 * 60,
  daytimeEnd: 18 * 60,
  /** The evening place starts at this time… */
  eveningStart: 19 * 60 + 30,
  /** …or later, up to this time, when the day starts late (a late landing): dinner after settling in. */
  eveningLatestStart: 21 * 60 + 30,

  /** At most this many daytime stops, even when more would fit; and one evening place. */
  maxDaytimeStops: 6,
  maxEveningStops: 1,
  /** A gap longer than this between the last daytime stop and the evening place shows as free time. */
  freeTimeMin: 90,

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
