import { describe, expect, it, vi } from "vitest";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
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
