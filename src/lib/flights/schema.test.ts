import { describe, expect, it } from "vitest";
import { IST_BCN as ist } from "./__fixtures__/samples";
import { parsePricesResponse } from "./schema";

const ticket = ist.data[0];

describe("parsePricesResponse", () => {
  it("reads a documented response", () => {
    const parsed = parsePricesResponse(ist);
    expect(parsed).toMatchObject({ ok: true, dropped: 0 });
    if (!parsed.ok) return;
    expect(parsed.tickets).toHaveLength(6);
    expect(parsed.tickets[0]).toMatchObject({ origin_airport: "IST", destination_airport: "BCN", price: 7480, airline: "TK", flight_number: "1853" });
  });

  it("accepts numeric flight numbers as text", () => {
    const parsed = parsePricesResponse({ success: true, data: [{ ...ticket, flight_number: 1853 }], error: null });
    expect(parsed.ok && parsed.tickets[0].flight_number).toBe("1853");
  });

  it("drops a ticket that does not match, instead of guessing", () => {
    const parsed = parsePricesResponse({
      success: true,
      error: null,
      data: [ticket, { ...ticket, price: "cheap" }, { ...ticket, departure_at: "tomorrow" }, { ...ticket, link: "https://elsewhere" }],
    });
    expect(parsed).toMatchObject({ ok: true, dropped: 3 });
    expect(parsed.ok && parsed.tickets).toHaveLength(1);
  });

  it("reports API errors and unexpected shapes", () => {
    // On errors the documented `data` is an empty object.
    expect(parsePricesResponse({ success: false, data: {}, error: "Unauthorized" })).toEqual({ ok: false, error: "Unauthorized" });
    expect(parsePricesResponse({ success: true, data: {}, error: null })).toEqual({ ok: false, error: "unexpected response shape" });
    expect(parsePricesResponse("<html>")).toMatchObject({ ok: false });
    expect(parsePricesResponse({ success: true, data: [ticket], currency: "rub" })).toEqual({ ok: false, error: "unexpected currency rub" });
  });
});
