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
const ORIGIN_TIME_ZONE = "Europe/Istanbul";

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

export type AirportGroup =
  /** Tickets on the chosen dates. */
  | { airport: string; outcome: "exact"; tickets: FlightTicket[] }
  /** Nothing on the chosen dates; the cheapest within ±3 days, each marked as a different date. */
  | { airport: string; outcome: "nearby"; tickets: FlightTicket[] }
  /** Nothing on the chosen dates or nearby. */
  | { airport: string; outcome: "none"; tickets: [] }
  | { airport: string; outcome: "error"; reason: FlightsErrorReason; tickets: [] };

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

/**
 * Cached prices for every origin airport, grouped by airport. IST and SAW are
 * queried separately (ESB for Ankara). Real responses mix airports: IST is also
 * Istanbul's city code, and an IST query returns SAW tickets that the SAW
 * query itself may not (2026-10-17: 15 against 10 for IST→BCN). So the
 * tickets of all queries are pooled, deduplicated and grouped by the airport
 * each one actually leaves from.
 *
 * Never throws: without a token, or when every airport fails, the result says
 * why and carries links to live prices.
 */
export async function searchFlights(search: FlightsSearch, deps: SearchDeps = {}): Promise<FlightsResult> {
  const config = flightsConfig();
  const fixture = deps.fixture ?? fixturesEnabled();
  const token = deps.token !== undefined ? deps.token : config.token;
  const partner = deps.partner ?? config.partner;
  const links = searchLinks(search, partner);

  const fetcher = deps.fetcher ?? (fixture ? fixtureFetcher : undefined);
  if (!token && !fixture) return { status: "unavailable", reason: "no-token", links };
  const load = (query: PricesQuery) => fetchPrices(query, { token: token ?? "fixture", fetcher });

  const airports: readonly string[] = search.origin.airports;
  const ctx: TicketContext = {
    originTimeZone: ORIGIN_TIME_ZONE,
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

  const exact = await Promise.all(airports.map((airport) => load(query(airport, search.depart, search.return, EXACT_LIMIT))));
  const onDates = usable(exact).filter((t) => !t.differentDates);

  const groups = await Promise.all(
    airports.map(async (airport, i): Promise<AirportGroup> => {
      const own = mergeSameOutbound(onDates.filter((t) => t.originAirport === airport));
      if (own.length) return { airport, outcome: "exact", tickets: own.slice(0, TICKETS_PER_AIRPORT) };
      const result = exact[i];
      if (!result.ok) return { airport, outcome: "error", reason: result.reason, tickets: [] };

      // Nothing on the chosen dates: look ±3 days with month-wide requests, then keep only that window.
      const months = await Promise.all(
        nearbyMonthPairs(search.depart, search.return).map(({ departMonth, returnMonth }) =>
          load(query(airport, departMonth, returnMonth, MONTH_LIMIT)),
        ),
      );
      const nearby = mergeSameOutbound(
        usable(months).filter(
          (t) => t.originAirport === airport && t.differentDates && isNearby(t, search.depart, search.return, search.today, NEARBY_DAYS),
        ),
      );
      return nearby.length
        ? { airport, outcome: "nearby", tickets: nearby.slice(0, TICKETS_PER_AIRPORT) }
        : { airport, outcome: "none", tickets: [] };
    }),
  );

  const errors = groups.filter((g) => g.outcome === "error");
  if (errors.length === groups.length) return { status: "unavailable", reason: errors[0].reason, links };

  // "Cheapest overall" only ever means the chosen dates; a nearby-date ticket is never presented as that.
  const best = cheapest(groups.flatMap((g) => (g.outcome === "exact" ? g.tickets : [])));
  return { status: "ok", groups, cheapestId: best?.id ?? null, direct: search.direct, fixture, links };
}
