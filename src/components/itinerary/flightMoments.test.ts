import { describe, expect, it } from "vitest";
import { IST_BCN } from "@/lib/flights/__fixtures__/samples";
import { apiTicketSchema } from "@/lib/flights/schema";
import { toFlightTicket } from "@/lib/flights/tickets";
import { flightMoments } from "./ItinerarySection";

const ctx = { originTimeZone: "Europe/Istanbul", destinationTimeZone: "Europe/Madrid", destinationCity: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };

describe("flightMoments", () => {
  it("gives landing and return departure in the destination's local time", () => {
    // TK 1853: IST 07:35 (+03) → BCN 09:40 (+01); back BCN 13:10.
    const ticket = toFlightTicket(apiTicketSchema.parse(IST_BCN.data[0]), ctx);
    expect(flightMoments(ticket)).toEqual({
      arrive: { date: "2026-11-14", time: "09:40" },
      leave: { date: "2026-11-18", time: "13:10" },
      label: "Türk Hava Yolları · TK 1853",
    });
  });

  it("moves an arrival after midnight to the next local date, and has nothing without a ticket", () => {
    const late = toFlightTicket(apiTicketSchema.parse({ ...IST_BCN.data[0], departure_at: "2026-11-14T23:50:00+03:00" }), ctx);
    expect(flightMoments(late)?.arrive).toEqual({ date: "2026-11-15", time: "01:55" });
    expect(flightMoments(null)).toBeNull();
  });
});
