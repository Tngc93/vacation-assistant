import "server-only";
import type { Destination } from "@/data/destinations";
import type { Origin } from "@/data/origins";
import { fetchPrices, flightsConfig, type Fetcher, type FetchOutcome } from "./client";
import type { FlightsErrorReason } from "./errors";
import { fixtureFetcher, fixturesEnabled } from "./fixtures";
import { aviasalesSearchUrl, googleFlightsUrl, type Partner } from "./links";
import { EXACT_LIMIT, MONTH_LIMIT, NEARBY_DAYS, nearbyMonthPairs, type PricesQuery } from "./params";
import { cheapest, isDirect, isNearby, mergeSameOutbound, toFlightTicket, uniqueTickets, type FlightTicket, type TicketContext } from "./tickets";

/** Cards shown per airport, after tickets with the same outbound flight are merged into one card. */
export const TICKETS_PER_AIRPORT = 5;

export type FlightsSearch = {
  origin: Origin;
  destination: Destination;
  depart: string;
  return: string;
  pax: number;
  direct: boolean;
  /** Today in Istanbul (YYYY-MM-DD); nearby dates never fall before it. */
  today: string;
};

/** `airport` is the IATA code, `name` the airport's name from the origins data. */
export type AirportGroup =
  /** Tickets on the chosen dates. */
  | { airport: string; name: string; outcome: "exact"; tickets: FlightTicket[] }
  /** Nothing on the chosen dates; the cheapest within ±3 days, each marked as a different date. */
  | { airport: string; name: string; outcome: "nearby"; tickets: FlightTicket[] }
  /** Nothing on the chosen dates or nearby. */
  | { airport: string; name: string; outcome: "none"; tickets: [] }
  | { airport: string; name: string; outcome: "error"; reason: FlightsErrorReason; tickets: [] };

export type FlightsLinks = { aviasales: string; googleFlights: string };

export type FlightsResult =
  | { status: "ok"; groups: AirportGroup[]; cheapestId: string | null; direct: boolean; fixture: boolean; links: FlightsLinks }
  | { status: "unavailable"; reason: FlightsErrorReason; links: FlightsLinks };

export type SearchDeps = { fetcher?: Fetcher; token?: string | null; partner?: Partner; fixture?: boolean };

/** Links to the whole search (origin city, all airports), for when cards cannot be shown or as an extra. */
export function searchLinks(search: Omit<FlightsSearch, "today" | "direct">, partner?: Partner): FlightsLinks {
  const route = { origin: search.origin.code, destination: search.destination.cityCode, depart: search.depart, return: search.return };
  return { aviasales: aviasalesSearchUrl({ ...route, pax: search.pax }, partner), googleFlights: googleFlightsUrl(route) };
}

/** More origin airports than this with nothing on the dates: the ±3 day fallback asks once for the whole city. */
export const MAX_FALLBACK_AIRPORTS = 2;

/** True when the trip would leave from the city it goes to (same city code, or an airport the two share). */
export function isSameCity(origin: Origin, destination: Destination): boolean {
  return origin.code === destination.cityCode || origin.airports.some((a) => a.code === destination.cityCode || destination.airports.includes(a.code));
}

/**
 * Cached prices for every origin airport, grouped by airport. Each airport is
 * queried on its own, and a city with several airports under a code of its
 * own (LON, NYC) is queried by that code too. Real responses mix airports: IST
 * is also Istanbul's city code, and an IST query returns SAW tickets that the
 * SAW query itself may not (2026-10-17: 15 against 10 for IST→BCN). So the
 * tickets of all queries are pooled, deduplicated and grouped by the airport
 * each one actually leaves from.
 *
 * Never throws: without a token, or when every airport fails, the result says
 * why and carries links to live prices. A trip from the city it goes to is not
 * searched at all.
 */
export async function searchFlights(search: FlightsSearch, deps: SearchDeps = {}): Promise<FlightsResult> {
  const config = flightsConfig();
  const fixture = deps.fixture ?? fixturesEnabled();
  const token = deps.token !== undefined ? deps.token : config.token;
  const partner = deps.partner ?? config.partner;
  const links = searchLinks(search, partner);

  if (isSameCity(search.origin, search.destination)) return { status: "unavailable", reason: "same-city", links };
  const fetcher = deps.fetcher ?? (fixture ? fixtureFetcher : undefined);
  if (!token && !fixture) return { status: "unavailable", reason: "no-token", links };
  const load = (query: PricesQuery) => fetchPrices(query, { token: token ?? "fixture", fetcher });

  const airports = search.origin.airports.map((a) => a.code);
  const ctx: TicketContext = {
    originTimeZone: search.origin.timeZone,
    destinationTimeZone: search.destination.timeZone,
    destinationCity: search.destination.cityCode,
    depart: search.depart,
    return: search.return,
    pax: search.pax,
    partner,
  };
  const query = (origin: string, departureAt: string, returnAt: string, limit: number): PricesQuery => ({
    origin,
    destination: search.destination.cityCode,
    departureAt,
    returnAt,
    direct: search.direct,
    limit,
  });
  const usable = (outcomes: FetchOutcome[]) =>
    uniqueTickets(
      outcomes
        .flatMap((o) => (o.ok ? o.tickets : []))
        .map((t) => toFlightTicket(t, ctx))
        .filter((t) => airports.includes(t.originAirport) && t.back !== null && (!search.direct || isDirect(t))),
    );

  // One query per airport (outcome i is airport i), plus the city code when it is not one of them.
  const cityQuery = airports.length > 1 && !airports.includes(search.origin.code) ? [search.origin.code] : [];
  const exact = await Promise.all([...airports, ...cityQuery].map((code) => load(query(code, search.depart, search.return, EXACT_LIMIT))));
  const onDates = usable(exact).filter((t) => !t.differentDates);
  const own = airports.map((airport) => mergeSameOutbound(onDates.filter((t) => t.originAirport === airport)));

  // Nothing on the chosen dates: look ±3 days with month-wide requests, then keep only that window. Per airport,
  // or once for the whole city when many airports need it (London has six).
  const missing = airports.filter((_, i) => !own[i].length && exact[i].ok);
  const fallback = missing.length > MAX_FALLBACK_AIRPORTS ? [search.origin.code] : missing;
  const months = await Promise.all(
    fallback.flatMap((code) =>
      nearbyMonthPairs(search.depart, search.return).map(({ departMonth, returnMonth }) => load(query(code, departMonth, returnMonth, MONTH_LIMIT))),
    ),
  );
  const nearbyPool = usable(months).filter((t) => t.differentDates && isNearby(t, search.depart, search.return, search.today, NEARBY_DAYS));

  const groups = airports.map((airport, i): AirportGroup => {
    const name = search.origin.airports[i].name;
    if (own[i].length) return { airport, name, outcome: "exact", tickets: own[i].slice(0, TICKETS_PER_AIRPORT) };
    const result = exact[i];
    if (!result.ok) return { airport, name, outcome: "error", reason: result.reason, tickets: [] };
    const nearby = mergeSameOutbound(nearbyPool.filter((t) => t.originAirport === airport));
    return nearby.length
      ? { airport, name, outcome: "nearby", tickets: nearby.slice(0, TICKETS_PER_AIRPORT) }
      : { airport, name, outcome: "none", tickets: [] };
  });

  const errors = groups.filter((g) => g.outcome === "error");
  if (errors.length === groups.length) return { status: "unavailable", reason: errors[0].reason, links };

  // "Cheapest overall" only ever means the chosen dates; a nearby-date ticket is never presented as that.
  const best = cheapest(groups.flatMap((g) => (g.outcome === "exact" ? g.tickets : [])));
  return { status: "ok", groups, cheapestId: best?.id ?? null, direct: search.direct, fixture, links };
}
