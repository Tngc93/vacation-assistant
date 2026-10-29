import { describe, expect, it, vi } from "vitest";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/lib/origins/data";
import { ESB_AMS_NOVEMBER as esbMonth } from "./__fixtures__/samples";
import { IST_BCN as ist } from "./__fixtures__/samples";
import { SAW_BCN as saw } from "./__fixtures__/samples";
import type { Fetcher } from "./client";
import { searchFlights, type FlightsSearch } from "./search";

const istanbul: FlightsSearch = {
  origin: findOrigin("IST")!,
  destination: findDestination("BCN")!,
  depart: "2026-11-14",
  return: "2026-11-18",
  pax: 2,
  direct: false,
  today: "2026-10-17",
};
const ankara: FlightsSearch = { ...istanbul, origin: findOrigin("ESB")!, destination: findDestination("AMS")!, pax: 1 };

/** Answers by `origin-departure_at`; anything else is an empty cache. */
function routes(map: Record<string, unknown[] | number>) {
  return vi.fn<Fetcher>(async (url) => {
    const p = new URL(url).searchParams;
    const found = map[`${p.get("origin")}-${p.get("departure_at")}`] ?? [];
    if (typeof found === "number") return new Response("{}", { status: found });
    const data = p.get("direct") === "true" ? found.filter((t) => (t as { transfers: number }).transfers === 0) : found;
    return Response.json({ success: true, data, error: null, currency: "try" });
  });
}
const NO_PARTNER = { marker: null, trs: null };
const deps = (fetcher: Fetcher) => ({ fetcher, token: "t", partner: NO_PARTNER, fixture: false });
const origins = (fetcher: ReturnType<typeof routes>) => fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("origin"));

describe("searchFlights", () => {
  it("queries IST and SAW separately and groups by airport", async () => {
    const fetcher = routes({ "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data });
    const result = await searchFlights(istanbul, deps(fetcher));
    expect(origins(fetcher).sort()).toEqual(["IST", "SAW"]);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.groups.map((g) => [g.airport, g.outcome, g.tickets.length])).toEqual([
      ["IST", "exact", 4],
      ["SAW", "exact", 3],
    ]);
    // The SAW ticket inside the IST answer stays out of the IST group (and appears once under SAW).
    expect(result.groups[0].tickets.every((t) => t.originAirport === "IST")).toBe(true);
    expect(result.groups[1].tickets.filter((t) => t.flightNumber === "1203")).toHaveLength(1);
  });

  it("puts SAW tickets that only the IST answer has into the SAW group", async () => {
    // Real data: the IST query returned SAW tickets the SAW query did not.
    const onlyInIst = { ...saw.data[0], flight_number: "9999", price: 4100 };
    const result = await searchFlights(istanbul, deps(routes({ "IST-2026-11-14": [...ist.data, onlyInIst], "SAW-2026-11-14": saw.data })));
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.groups[1].tickets[0]).toMatchObject({ originAirport: "SAW", flightNumber: "9999", pricePerAdult: 4100 });
    expect(result.cheapestId).toBe(result.groups[1].tickets[0].id);
  });

  it("applies the 5 cards per airport after merging returns of the same outbound flight", async () => {
    const base = ist.data[0];
    const outbound = (n: number) => ({ ...base, flight_number: String(2000 + n), price: 9000 + n * 100 });
    // Six outbound flights; the cheapest has three return options.
    const data = [
      outbound(0),
      { ...outbound(0), price: 9050, return_at: "2026-11-18T08:00:00+01:00" },
      { ...outbound(0), price: 9070, return_at: "2026-11-18T21:00:00+01:00" },
      ...[1, 2, 3, 4, 5].map(outbound),
    ];
    const result = await searchFlights(istanbul, deps(routes({ "IST-2026-11-14": data })));
    if (result.status !== "ok") throw new Error(result.status);
    const cards = result.groups[0].tickets;
    expect(cards.map((t) => t.flightNumber)).toEqual(["2000", "2001", "2002", "2003", "2004"]);
    expect(cards[0].otherReturns.map((t) => t.pricePerAdult)).toEqual([9050, 9070]);
    expect(result.cheapestId).toBe(cards[0].id);
  });

  it("asks for 100 rows, enough for both airports in one IST answer", async () => {
    const fetcher = routes({ "IST-2026-11-14": ist.data });
    await searchFlights(istanbul, deps(fetcher));
    expect(fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("limit"))).toEqual(["100", "100"]);
  });

  it("wraps booking links in the partner link when marker and project are set", async () => {
    const result = await searchFlights(istanbul, { ...deps(routes({ "IST-2026-11-14": ist.data })), partner: { marker: "4242", trs: "777" } });
    if (result.status !== "ok") throw new Error(result.status);
    for (const url of [result.links.aviasales, result.groups[0].tickets[0].bookingUrl]) {
      const link = new URL(url);
      expect(link.origin + link.pathname).toBe("https://tp.media/r");
      expect(link.searchParams.get("marker")).toBe("4242");
      expect(link.searchParams.get("trs")).toBe("777");
    }
  });

  it("marks the cheapest overall and keeps each group cheapest first", async () => {
    const result = await searchFlights(istanbul, deps(routes({ "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data })));
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.groups.map((g) => g.tickets[0].pricePerAdult)).toEqual([5310, 4380]);
    const best = result.groups.flatMap((g) => g.tickets).find((t) => t.id === result.cheapestId);
    expect(best).toMatchObject({ originAirport: "SAW", pricePerAdult: 4380, totalPrice: 8760 });
  });

  it("queries ESB for Ankara and falls back to ±3 days, never as the chosen dates", async () => {
    const fetcher = routes({ "ESB-2026-11": esbMonth.data });
    const result = await searchFlights(ankara, deps(fetcher));
    expect(fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("departure_at"))).toEqual(["2026-11-14", "2026-11"]);
    if (result.status !== "ok") throw new Error(result.status);
    const [group] = result.groups;
    expect(group.outcome).toBe("nearby");
    expect(group.tickets.map((t) => [t.out.departDate, t.back?.departDate])).toEqual([
      ["2026-11-12", "2026-11-16"],
      ["2026-11-13", "2026-11-17"],
      ["2026-11-15", "2026-11-19"],
    ]);
    expect(group.tickets.every((t) => t.differentDates)).toBe(true);
    // The 25 Nov ticket is cheaper but outside the window; nothing nearby counts as "cheapest overall".
    expect(group.tickets.some((t) => t.out.departDate === "2026-11-25")).toBe(false);
    expect(result.cheapestId).toBeNull();
  });

  it("asks the API for non-stop tickets and says when there are none", async () => {
    const fetcher = routes({ "ESB-2026-11": esbMonth.data });
    const result = await searchFlights({ ...ankara, direct: true }, deps(fetcher));
    expect(fetcher.mock.calls.every(([url]) => new URL(url).searchParams.get("direct") === "true")).toBe(true);
    expect(result.status === "ok" && result.groups[0].outcome).toBe("none");

    const both = await searchFlights({ ...istanbul, direct: true }, deps(routes({ "IST-2026-11-14": ist.data, "SAW-2026-11-14": saw.data })));
    if (both.status !== "ok") throw new Error(both.status);
    expect(both.groups.flatMap((g) => g.tickets).every((t) => t.out.stops === 0 && t.back?.stops === 0)).toBe(true);
  });

  it("does not call the API without a token, and still offers links", async () => {
    const fetcher = routes({});
    const result = await searchFlights(istanbul, { fetcher, token: null, partner: { marker: "4242", trs: null }, fixture: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "unavailable",
      reason: "no-token",
      links: {
        aviasales: "https://www.aviasales.com/search/IST1411BCN18112?marker=4242",
        googleFlights: expect.stringContaining("https://www.google.com/travel/flights?q=Flights+to+BCN+from+IST"),
      },
    });
  });

  it("shows one airport's error next to the other's tickets, and a calm message when all fail", async () => {
    const partial = await searchFlights(istanbul, deps(routes({ "IST-2026-11-14": 429, "SAW-2026-11-14": saw.data })));
    if (partial.status !== "ok") throw new Error(partial.status);
    expect(partial.groups.map((g) => g.outcome)).toEqual(["error", "exact"]);
    expect(partial.groups[0]).toMatchObject({ outcome: "error", reason: "rate-limited" });

    const down = await searchFlights(istanbul, deps(routes({ "IST-2026-11-14": 503, "SAW-2026-11-14": 503 })));
    expect(down).toMatchObject({ status: "unavailable", reason: "server" });
    const denied = await searchFlights(ankara, deps(routes({ "ESB-2026-11-14": 401 })));
    expect(denied).toMatchObject({ status: "unavailable", reason: "unauthorized" });
  });

  it("searches every London airport and the city code, and groups the pooled answers by airport", async () => {
    const london: FlightsSearch = { ...istanbul, origin: findOrigin("LON")!, destination: findDestination("BCN")!, pax: 1 };
    const from = (airport: string, flight: string, price: number) => ({
      ...ist.data[0],
      origin_airport: airport,
      origin: "LON",
      flight_number: flight,
      price,
      departure_at: "2026-11-14T06:00:00+00:00",
    });
    // The LON answer carries a Luton ticket the LTN answer itself does not.
    const fetcher = routes({
      "LGW-2026-11-14": [from("LGW", "8001", 3100)],
      "STN-2026-11-14": [from("STN", "8002", 2400)],
      "LON-2026-11-14": [from("LGW", "8001", 3100), from("LTN", "8003", 1900)],
    });
    const result = await searchFlights(london, deps(fetcher));
    const exactCalls = fetcher.mock.calls.map(([url]) => new URL(url).searchParams).filter((q) => q.get("departure_at") === "2026-11-14");
    expect(exactCalls.map((q) => q.get("origin")).sort()).toEqual(["LCY", "LGW", "LHR", "LON", "LTN", "SEN", "STN"]);
    if (result.status !== "ok") throw new Error(result.status);
    const byAirport = Object.fromEntries(result.groups.map((g) => [g.airport, g.tickets.map((t) => t.flightNumber)]));
    expect(byAirport).toMatchObject({ LGW: ["8001"], STN: ["8002"], LTN: ["8003"], LHR: [], LCY: [], SEN: [] });
    expect(result.groups.find((g) => g.airport === "LHR")?.name).toMatch(/Heathrow/);
    // Cheapest overall is the Luton ticket found only through the city code.
    expect(result.groups.flatMap((g) => g.tickets).find((t) => t.id === result.cheapestId)?.flightNumber).toBe("8003");
    // Three airports had nothing on the dates: the ±3 day fallback asks once, for the whole city.
    const monthCalls = fetcher.mock.calls.map(([url]) => new URL(url).searchParams).filter((q) => q.get("departure_at")?.length === 7);
    expect([...new Set(monthCalls.map((q) => q.get("origin")))]).toEqual(["LON"]);
    // Departure times are local to the origin: 06:00 in London (it would be 09:00 in İstanbul).
    expect(result.groups.find((g) => g.airport === "LTN")?.tickets[0].out.departTime).toBe("06:00");
  });

  it("groups New York under one city: JFK, EWR and LGA", async () => {
    const nyc = findOrigin("NYC")!;
    expect(nyc.airports.map((a) => a.code)).toEqual(["EWR", "JFK", "LGA"]);
    const fetcher = routes({});
    const result = await searchFlights({ ...istanbul, origin: nyc }, deps(fetcher));
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.groups.map((g) => [g.airport, g.outcome])).toEqual([
      ["EWR", "none"],
      ["JFK", "none"],
      ["LGA", "none"],
    ]);
    expect(result.links.aviasales).toBe("https://www.aviasales.com/search/NYC1411BCN18112");
  });

  it("does not search when the origin is the destination city", async () => {
    const fetcher = routes({ "BCN-2026-11-14": ist.data });
    const result = await searchFlights({ ...istanbul, origin: findOrigin("BCN")! }, deps(fetcher));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "unavailable", reason: "same-city" });
  });

  it("serves labelled sample data in fixture mode without a token, for any trip dates", async () => {
    const march = { depart: "2027-03-14", return: "2027-03-18" };
    const result = await searchFlights({ ...istanbul, ...march }, { token: null, partner: NO_PARTNER, fixture: true });
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.fixture).toBe(true);
    expect(result.groups.map((g) => g.outcome)).toEqual(["exact", "exact"]);
    expect(result.groups[0].tickets[0].out.departDate).toBe("2027-03-14");

    const nearby = await searchFlights({ ...ankara, ...march }, { token: null, partner: NO_PARTNER, fixture: true });
    if (nearby.status !== "ok") throw new Error(nearby.status);
    expect(nearby.groups[0].outcome).toBe("nearby");
    expect(nearby.groups[0].tickets.map((t) => t.out.departDate)).toEqual(["2027-03-12", "2027-03-13", "2027-03-15"]);
  });
});
