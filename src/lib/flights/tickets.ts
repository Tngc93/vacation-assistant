import { daysBetween } from "@/lib/search/dates";
import { aviasalesSearchUrl, type Partner } from "./links";
import type { ApiTicket } from "./schema";

/** One direction of a round trip, in the local time of each airport. */
export type Leg = {
  from: string;
  to: string;
  /** YYYY-MM-DD and HH:mm at the departure airport. */
  departDate: string;
  departTime: string;
  /** HH:mm at the arrival airport, from departure + duration; null when the API gives no duration. */
  arriveTime: string | null;
  /** Days between departure and arrival dates in local time (overnight flights: 1). */
  arriveDayOffset: number;
  stops: number;
  durationMin: number | null;
};

/** A ticket ready to render; plain data so it can cross to client components. */
export type FlightTicket = {
  id: string;
  originAirport: string;
  destinationAirport: string;
  airline: string;
  flightNumber: string;
  out: Leg;
  back: Leg | null;
  pricePerAdult: number;
  pax: number;
  /** pricePerAdult × pax: an estimate, the API prices one adult only. */
  totalPrice: number;
  /** True when the ticket's dates are not the ones the user chose (±3 day fallback). */
  differentDates: boolean;
  /** Day the price was found (from the ticket link's search_date), when the API says. */
  foundOn: string | null;
  /** Aviasales search for this ticket's airports, dates and passengers. */
  bookingUrl: string;
};

export type TicketContext = {
  /** IANA zone of the origin airports (Istanbul for every phase-1 origin). */
  originTimeZone: string;
  destinationTimeZone: string;
  /** IATA city code of the destination, for the booking link. */
  destinationCity: string;
  depart: string;
  return: string;
  pax: number;
  partner?: Partner;
};

const partsCache = new Map<string, Intl.DateTimeFormat>();
function localParts(instant: number, timeZone: string): { date: string; time: string } {
  let format = partsCache.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, format);
  }
  const parts = format.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function leg(from: string, to: string, departIso: string, durationMin: number | undefined, stops: number, fromZone: string, toZone: string): Leg {
  const start = Date.parse(departIso);
  const depart = localParts(start, fromZone);
  const arrive = durationMin ? localParts(start + durationMin * 60_000, toZone) : null;
  return {
    from,
    to,
    departDate: depart.date,
    departTime: depart.time,
    arriveTime: arrive?.time ?? null,
    arriveDayOffset: arrive ? daysBetween(depart.date, arrive.date) : 0,
    stops,
    durationMin: durationMin ?? null,
  };
}

/** "search_date=11052023" in the ticket link → "2023-05-11". */
export function foundOnFromLink(link: string): string | null {
  const match = /[?&]search_date=(\d{2})(\d{2})(\d{4})(?:&|$)/.exec(link);
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

export function toFlightTicket(api: ApiTicket, ctx: TicketContext): FlightTicket {
  const out = leg(api.origin_airport, api.destination_airport, api.departure_at, api.duration_to, api.transfers, ctx.originTimeZone, ctx.destinationTimeZone);
  const back = api.return_at
    ? leg(api.destination_airport, api.origin_airport, api.return_at, api.duration_back, api.return_transfers ?? 0, ctx.destinationTimeZone, ctx.originTimeZone)
    : null;
  const returnDate = back?.departDate ?? null;
  return {
    id: `${api.origin_airport}-${api.airline}${api.flight_number}-${api.departure_at}-${api.return_at ?? ""}`,
    originAirport: api.origin_airport,
    destinationAirport: api.destination_airport,
    airline: api.airline,
    flightNumber: api.flight_number,
    out,
    back,
    pricePerAdult: api.price,
    pax: ctx.pax,
    totalPrice: api.price * ctx.pax,
    differentDates: out.departDate !== ctx.depart || returnDate !== ctx.return,
    foundOn: foundOnFromLink(api.link),
    bookingUrl: aviasalesSearchUrl(
      { origin: api.origin_airport, destination: ctx.destinationCity, depart: out.departDate, return: returnDate ?? ctx.return, pax: ctx.pax },
      ctx.partner,
    ),
  };
}

/** Both legs non-stop. */
export const isDirect = (t: FlightTicket) => t.out.stops === 0 && (t.back?.stops ?? 0) === 0;

/** Within `days` of the chosen dates on both legs, round trip, and not before today. */
export function isNearby(t: FlightTicket, depart: string, ret: string, today: string, days: number): boolean {
  if (!t.back) return false;
  return (
    t.out.departDate >= today &&
    t.back.departDate >= t.out.departDate &&
    Math.abs(daysBetween(depart, t.out.departDate)) <= days &&
    Math.abs(daysBetween(ret, t.back.departDate)) <= days
  );
}

/** Cheapest first; ties keep the earlier departure first so the order is stable. */
export function byPrice(a: FlightTicket, b: FlightTicket): number {
  return a.pricePerAdult - b.pricePerAdult || a.out.departDate.localeCompare(b.out.departDate) || a.out.departTime.localeCompare(b.out.departTime) || a.id.localeCompare(b.id);
}

export function uniqueTickets(tickets: readonly FlightTicket[]): FlightTicket[] {
  const seen = new Map<string, FlightTicket>();
  for (const t of tickets) {
    const kept = seen.get(t.id);
    if (!kept || t.pricePerAdult < kept.pricePerAdult) seen.set(t.id, t);
  }
  return [...seen.values()];
}

export function cheapest(tickets: readonly FlightTicket[]): FlightTicket | null {
  return tickets.length ? [...tickets].sort(byPrice)[0] : null;
}
