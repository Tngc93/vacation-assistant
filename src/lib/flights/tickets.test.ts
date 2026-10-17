import { describe, expect, it } from "vitest";
import { IST_BCN as ist } from "./__fixtures__/samples";
import { apiTicketSchema } from "./schema";
import { byPrice, cheapest, foundOnFromLink, isDirect, isNearby, toFlightTicket, uniqueTickets } from "./tickets";

const ctx = {
  originTimeZone: "Europe/Istanbul",
  destinationTimeZone: "Europe/Madrid",
  destinationCity: "BCN",
  depart: "2026-11-14",
  return: "2026-11-18",
  pax: 2,
};
const api = (i: number, patch: Record<string, unknown> = {}) => apiTicketSchema.parse({ ...ist.data[i], ...patch });

describe("toFlightTicket", () => {
  it("shows local times at each airport, with arrival from departure + duration", () => {
    const t = toFlightTicket(api(0), ctx);
    expect(t.out).toEqual({
      from: "IST",
      to: "BCN",
      departDate: "2026-11-14",
      departTime: "07:35",
      arriveTime: "09:40",
      arriveDayOffset: 0,
      stops: 0,
      durationMin: 245,
    });
    expect(t.back).toMatchObject({ from: "BCN", to: "IST", departDate: "2026-11-18", departTime: "13:10", arriveTime: "18:45" });
  });

  it("marks an arrival on the next local day", () => {
    const t = toFlightTicket(api(3), ctx);
    expect(t.back).toMatchObject({ departTime: "19:55", arriveTime: "01:30", arriveDayOffset: 1 });
  });

  it("prices one adult and multiplies by passengers for the estimated total", () => {
    const t = toFlightTicket(api(0), ctx);
    expect(t).toMatchObject({ pricePerAdult: 7480, pax: 2, totalPrice: 14960, differentDates: false });
  });

  it("links to the Aviasales search for the ticket's own airport, dates and passengers", () => {
    expect(toFlightTicket(api(0), { ...ctx, marker: "777" }).bookingUrl).toBe(
      "https://www.aviasales.com/search/IST1411BCN18112?marker=777",
    );
  });

  it("flags tickets on other dates and has no arrival time without a duration", () => {
    const t = toFlightTicket(api(0, { departure_at: "2026-11-13T07:35:00+03:00", duration_to: undefined }), ctx);
    expect(t.differentDates).toBe(true);
    expect(t.out.arriveTime).toBeNull();
  });
});

describe("ticket helpers", () => {
  it("reads the search day from the ticket link", () => {
    expect(foundOnFromLink("/search/X?t=1&search_date=16102026&y=2")).toBe("2026-10-16");
    expect(foundOnFromLink("/search/X?t=1&search_date=16102026")).toBe("2026-10-16");
    expect(foundOnFromLink("/search/X?t=1")).toBeNull();
    expect(foundOnFromLink("/search/X?search_date=99")).toBeNull();
  });

  it("finds the cheapest and keeps one of each ticket", () => {
    const tickets = ist.data.slice(0, 4).map((_, i) => toFlightTicket(api(i), ctx));
    expect(cheapest(tickets)?.pricePerAdult).toBe(5310);
    expect([...tickets].sort(byPrice).map((t) => t.pricePerAdult)).toEqual([5310, 6920, 7480, 9150]);
    expect(uniqueTickets([...tickets, tickets[0]])).toHaveLength(4);
    expect(cheapest([])).toBeNull();
  });

  it("knows non-stop round trips", () => {
    expect(isDirect(toFlightTicket(api(0), ctx))).toBe(true);
    expect(isDirect(toFlightTicket(api(2), ctx))).toBe(false);
  });

  it("keeps nearby tickets within ±3 days on both legs and never before today", () => {
    const at = (d: string, r: string) => toFlightTicket(api(0, { departure_at: `${d}T10:00:00+03:00`, return_at: `${r}T10:00:00+01:00` }), ctx);
    const today = "2026-11-12";
    expect(isNearby(at("2026-11-11", "2026-11-21"), "2026-11-14", "2026-11-18", "2026-11-01", 3)).toBe(true);
    expect(isNearby(at("2026-11-10", "2026-11-18"), "2026-11-14", "2026-11-18", "2026-11-01", 3)).toBe(false);
    expect(isNearby(at("2026-11-14", "2026-11-22"), "2026-11-14", "2026-11-18", "2026-11-01", 3)).toBe(false);
    expect(isNearby(at("2026-11-11", "2026-11-18"), "2026-11-14", "2026-11-18", today, 3)).toBe(false);
  });
});
