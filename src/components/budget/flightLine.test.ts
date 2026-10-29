import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/lib/origins/data";
import { IST_BCN } from "@/lib/flights/__fixtures__/samples";
import type { Fetcher } from "@/lib/flights/client";
import { searchFlights } from "@/lib/flights/search";
import { chooseFlight } from "@/lib/flights/select";
import { flightLineFor } from "./BudgetSection";

const search = { origin: findOrigin("IST")!, destination: findDestination("BCN")!, depart: "2026-11-14", return: "2026-11-18", pax: 2, direct: false, today: "2026-10-17" };
const answer = (data: unknown[]): Fetcher => async (url) =>
  Response.json({ success: true, data: new URL(url).searchParams.get("origin") === "IST" && new URL(url).searchParams.get("departure_at") === "2026-11-14" ? data : [], error: null });
const deps = (fetcher: Fetcher) => ({ fetcher, token: "t", partner: { marker: null, trs: null }, fixture: false });

describe("flightLineFor", () => {
  it("names the cheapest ticket by default and says how to pick another", async () => {
    const result = await searchFlights(search, deps(answer(IST_BCN.data)));
    expect(flightLineFor(chooseFlight(result, null), result)).toMatchObject({
      kind: "ticket",
      label: "Pegasus · PC 1203 · SAW → BCN",
      pricePerAdult: 4990,
      note: expect.stringContaining("Bütçeye ekle"),
    });
  });

  it("explains why there is no flight row, without inventing one", async () => {
    const empty = await searchFlights(search, deps(answer([])));
    expect(flightLineFor(chooseFlight(empty, null), empty)).toEqual({ kind: "missing", reason: "SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK" });
    const noToken = await searchFlights(search, { token: null, partner: { marker: null, trs: null }, fixture: false });
    expect(flightLineFor(chooseFlight(noToken, null), noToken)).toEqual({ kind: "missing", reason: "TRAVELPAYOUTS BAĞLANTISI YOK" });
    expect(flightLineFor(chooseFlight(noToken, "IST-TK1-202611141000-202611181000"), noToken)).toEqual({
      kind: "missing",
      reason: "SEÇTİĞİN BİLET ARTIK ÖNBELLEKTE YOK",
    });
  });

  it("says when the chosen ticket left the cache", async () => {
    const result = await searchFlights(search, deps(answer(IST_BCN.data)));
    expect(flightLineFor(chooseFlight(result, "IST-TK9999-202611141000-202611181000"), result)).toMatchObject({
      kind: "ticket",
      note: "Seçtiğin bilet artık önbellekte yok; seçilen tarihlerdeki en ucuz bilet kullanıldı.",
    });
  });
});
