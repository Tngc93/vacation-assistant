import "server-only";
import type { Destination } from "@/data/destinations";
import type { Origin } from "@/data/origins";
import { fetchPrices, flightsConfig, type Fetcher, type FetchOutcome } from "./client";
import type { FlightsErrorReason } from "./errors";
import { fixtureFetcher, fixturesEnabled } from "./fixtures";
import { aviasalesSearchUrl, googleFlightsUrl } from "./links";
import { EXACT_LIMIT, MONTH_LIMIT, NEARBY_DAYS, nearbyMonthPairs, type PricesQuery } from "./params";
import { byPrice, cheapest, isDirect, isNearby, toFlightTicket, uniqueTickets, type FlightTicket } from "./tickets";

/** Tickets shown per airport. */
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

export type SearchDeps = { fetcher?: Fetcher; token?: string | null; marker?: string | null; fixture?: boolean };

/** Links to the whole search (origin city, all airports), for when cards cannot be shown or as an extra. */
export function searchLinks(search: Omit<FlightsSearch, "today" | "direct">, marker: string | null): FlightsLinks {
  const route = { origin: search.origin.code, destination: search.destination.cityCode, depart: search.depart, return: search.return };
  return { aviasales: aviasalesSearchUrl({ ...route, pax: search.pax }, marker ?? undefined), googleFlights: googleFlightsUrl(route) };
}

async function searchAirport(
  airport: string,
  search: FlightsSearch,
  load: (query: PricesQuery) => Promise<FetchOutcome>,
  marker: string | null,
): Promise<AirportGroup> {
  const ctx = {
    originTimeZone: ORIGIN_TIME_ZONE,
    destinationTimeZone: search.destination.timeZone,
    destinationCity: search.destination.cityCode,
    depart: search.depart,
    return: search.return,
    pax: search.pax,
    marker: marker ?? undefined,
  };
  // An airport query can also return the city's other airport (IST is also Istanbul's city code): keep only this one.
  const usable = (outcome: Extract<FetchOutcome, { ok: true }>) =>
    outcome.tickets
      .map((t) => toFlightTicket(t, ctx))
      .filter((t) => t.originAirport === airport && t.back !== null && (!search.direct || isDirect(t)));

  const exact = await load({
    origin: airport,
    destination: search.destination.cityCode,
    departureAt: search.depart,
    returnAt: search.return,
    direct: search.direct,
    limit: EXACT_LIMIT,
  });
  if (!exact.ok) return { airport, outcome: "error", reason: exact.reason, tickets: [] };
  const onDates = uniqueTickets(usable(exact).filter((t) => !t.differentDates)).sort(byPrice);
  if (onDates.length) return { airport, outcome: "exact", tickets: onDates.slice(0, TICKETS_PER_AIRPORT) };

  // Nothing on the chosen dates: look ±3 days with month-wide requests, then keep only that window.
  const months = await Promise.all(
    nearbyMonthPairs(search.depart, search.return).map(({ departMonth, returnMonth }) =>
      load({
        origin: airport,
        destination: search.destination.cityCode,
        departureAt: departMonth,
        returnAt: returnMonth,
        direct: search.direct,
        limit: MONTH_LIMIT,
      }),
    ),
  );
  const nearby = uniqueTickets(
    months.flatMap((m) => (m.ok ? usable(m) : [])).filter((t) => t.differentDates && isNearby(t, search.depart, search.return, search.today, NEARBY_DAYS)),
  ).sort(byPrice);
  return nearby.length
    ? { airport, outcome: "nearby", tickets: nearby.slice(0, TICKETS_PER_AIRPORT) }
    : { airport, outcome: "none", tickets: [] };
}

/**
 * Cached prices for every origin airport (IST and SAW separately, or ESB),
 * grouped by airport. Never throws: without a token, or when every airport
 * fails, the result says why and carries links to live prices.
 */
export async function searchFlights(search: FlightsSearch, deps: SearchDeps = {}): Promise<FlightsResult> {
  const config = flightsConfig();
  const fixture = deps.fixture ?? fixturesEnabled();
  const token = deps.token !== undefined ? deps.token : config.token;
  const marker = deps.marker !== undefined ? deps.marker : config.marker;
  const links = searchLinks(search, marker);

  const fetcher = deps.fetcher ?? (fixture ? fixtureFetcher : undefined);
  if (!token && !fixture) return { status: "unavailable", reason: "no-token", links };
  const load = (query: PricesQuery) => fetchPrices(query, { token: token ?? "fixture", fetcher });

  const groups = await Promise.all(search.origin.airports.map((airport) => searchAirport(airport, search, load, marker)));
  const errors = groups.filter((g) => g.outcome === "error");
  if (errors.length === groups.length) return { status: "unavailable", reason: errors[0].reason, links };

  // "Cheapest overall" only ever means the chosen dates; a nearby-date ticket is never presented as that.
  const best = cheapest(groups.flatMap((g) => (g.outcome === "exact" ? g.tickets : [])));
  return { status: "ok", groups, cheapestId: best?.id ?? null, direct: search.direct, fixture, links };
}
