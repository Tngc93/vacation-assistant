import type { FlightsResult } from "./search";
import type { FlightTicket } from "./tickets";

/** Which ticket the budget uses. */
export type FlightChoice =
  /** The ticket named in `?flight=`. */
  | { status: "selected"; ticket: FlightTicket }
  /** No choice made: the cheapest ticket on the chosen dates. */
  | { status: "cheapest"; ticket: FlightTicket }
  /** `?flight=` names a ticket that is no longer in the cached results; the cheapest is used instead, if any. */
  | { status: "selected-missing"; ticket: FlightTicket | null }
  /** No ticket on the chosen dates (or no flight data at all). */
  | { status: "none" };

/** Every ticket on the page: each card and the other returns listed under it. */
export function allTickets(result: FlightsResult): FlightTicket[] {
  return result.status === "ok" ? result.groups.flatMap((g) => g.tickets.flatMap((t) => [t, ...t.otherReturns])) : [];
}

export function chooseFlight(result: FlightsResult, ref: string | null): FlightChoice {
  const tickets = allTickets(result);
  const cheapest = result.status === "ok" ? (tickets.find((t) => t.id === result.cheapestId) ?? null) : null;
  if (ref) {
    const chosen = tickets.find((t) => t.ref === ref);
    if (chosen) return { status: "selected", ticket: chosen };
    return { status: "selected-missing", ticket: cheapest };
  }
  return cheapest ? { status: "cheapest", ticket: cheapest } : { status: "none" };
}

/** The ref of the ticket the budget is using, for the "Bütçede" state on cards. */
export function choiceRef(choice: FlightChoice): string | null {
  return choice.status === "none" ? null : (choice.ticket?.ref ?? null);
}
