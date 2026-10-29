import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/lib/origins/data";
import { IST_BCN, SAW_BCN } from "./__fixtures__/samples";
import type { Fetcher } from "./client";
import { searchFlights, type FlightsResult } from "./search";
import { allTickets, choiceRef, chooseFlight } from "./select";

const fetcher: Fetcher = async (url) => {
  const p = new URL(url).searchParams;
  const data = { IST: IST_BCN.data, SAW: SAW_BCN.data }[p.get("origin") as "IST" | "SAW"] ?? [];
  return Response.json({ success: true, data: p.get("departure_at") === "2026-11-14" ? data : [], error: null });
};
const search = {
  origin: findOrigin("IST")!,
  destination: findDestination("BCN")!,
  depart: "2026-11-14",
  return: "2026-11-18",
  pax: 2,
  direct: false,
  today: "2026-10-17",
};
const load = () => searchFlights(search, { fetcher, token: "t", partner: { marker: null, trs: null }, fixture: false });

describe("chooseFlight", () => {
  it("defaults to the cheapest ticket on the chosen dates", async () => {
    const choice = chooseFlight(await load(), null);
    expect(choice).toMatchObject({ status: "cheapest", ticket: { originAirport: "SAW", pricePerAdult: 4380 } });
  });

  it("uses the ticket named in the URL, including another return under a card", async () => {
    const result = await load();
    const other = allTickets(result).find((t) => t.flightNumber === "1301" && t.back?.departTime === "09:20")!;
    expect(other.ref).toBe("IST-LH1301-202611140610-202611180920");
    expect(chooseFlight(result, other.ref)).toEqual({ status: "selected", ticket: other });
    expect(choiceRef(chooseFlight(result, other.ref))).toBe(other.ref);
  });

  it("says when the chosen ticket left the cache, and falls back to the cheapest", async () => {
    const choice = chooseFlight(await load(), "IST-TK9999-202611141000-202611181000");
    expect(choice).toMatchObject({ status: "selected-missing", ticket: { pricePerAdult: 4380 } });
  });

  it("has no ticket when there are no flights", () => {
    const none: FlightsResult = { status: "unavailable", reason: "no-token", links: { aviasales: "a", googleFlights: "g" } };
    expect(chooseFlight(none, null)).toEqual({ status: "none" });
    expect(chooseFlight(none, "IST-TK1-202611141000-202611181000")).toEqual({ status: "selected-missing", ticket: null });
    expect(choiceRef({ status: "none" })).toBeNull();
  });
});
