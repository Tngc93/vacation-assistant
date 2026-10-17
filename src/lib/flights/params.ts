import { addDays } from "@/lib/search/dates";

export const PRICES_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
/**
 * How many tickets one exact-date request asks for. Real data (2026-10-17):
 * an IST query also returns SAW tickets (15 of 34 for IST→BCN), so 30 rows
 * were not enough to cover both airports.
 */
export const EXACT_LIMIT = 100;
/** Month-wide requests for the ±3 day fallback need more rows to cover the window. */
export const MONTH_LIMIT = 200;
/** The fallback looks this many days either side of the chosen dates. */
export const NEARBY_DAYS = 3;

export type PricesQuery = {
  /** IATA airport code (IST, SAW, ESB). */
  origin: string;
  /** IATA city code of the destination (BCN, AMS, LON…). */
  destination: string;
  /** YYYY-MM-DD for an exact day or YYYY-MM for a whole month. */
  departureAt: string;
  returnAt: string;
  direct: boolean;
  limit: number;
};

/**
 * Query string for `prices_for_dates`. The token is never part of it: it
 * travels in the X-Access-Token header, so it cannot end up in URLs or logs.
 * `one_way=false` asks for round trips (with `true` the API returns a single
 * ticket per date group).
 */
export function pricesSearchParams(query: PricesQuery): URLSearchParams {
  return new URLSearchParams({
    origin: query.origin,
    destination: query.destination,
    departure_at: query.departureAt,
    return_at: query.returnAt,
    one_way: "false",
    direct: String(query.direct),
    currency: "try",
    sorting: "price",
    unique: "false",
    limit: String(query.limit),
    page: "1",
  });
}

export function pricesUrl(query: PricesQuery): string {
  return `${PRICES_URL}?${pricesSearchParams(query)}`;
}

/**
 * The month pairs a ±3 day window touches: one pair usually, up to four when
 * the window crosses a month boundary on either side.
 */
export function nearbyMonthPairs(depart: string, ret: string, days = NEARBY_DAYS): Array<{ departMonth: string; returnMonth: string }> {
  const months = (date: string) => [...new Set([addDays(date, -days).slice(0, 7), addDays(date, days).slice(0, 7)])];
  return months(depart).flatMap((departMonth) =>
    months(ret).filter((returnMonth) => returnMonth >= departMonth).map((returnMonth) => ({ departMonth, returnMonth })),
  );
}
