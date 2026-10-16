import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { normalizeForSearch, searchDestinations } from "./normalize";

const first = (query: string) => searchDestinations(query)[0]?.cityCode;

describe("normalizeForSearch", () => {
  it.each([
    ["istanbul", "istanbul"],
    ["İSTANBUL", "istanbul"],
    ["ISTANBUL", "istanbul"],
    ["İstanbul", "istanbul"],
    ["Kopenhag", "kopenhag"],
    ["KOPENHAG", "kopenhag"],
    ["Münih", "munih"],
    ["ÇEKYA", "cekya"],
    ["Bükreş", "bukres"],
    ["Kraków", "krakow"],
    ["Sankt-Peterburg", "sankt peterburg"],
    ["  Abu   Dabi ", "abu dabi"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeForSearch(input)).toBe(expected);
  });
});

describe("searchDestinations", () => {
  it.each([
    ["Barselona", "BCN"],
    ["barselona", "BCN"],
    ["barcelona", "BCN"],
    ["BARCELONA", "BCN"],
    ["kopenhag", "CPH"],
    ["Kopenhag", "CPH"],
    ["copenhagen", "CPH"],
    ["münih", "MUC"],
    ["munih", "MUC"],
    ["munich", "MUC"],
    ["zurih", "ZRH"],
    ["bükreş", "BUH"],
    ["bukres", "BUH"],
  ])("finds %s by city name", (query, code) => {
    expect(first(query)).toBe(code);
  });

  it("matches IATA city and airport codes", () => {
    expect(first("bcn")).toBe("BCN");
    expect(first("LON")).toBe("LON");
    expect(first("lhr")).toBe("LON");
    expect(first("saw")).not.toBe("SAW");
  });

  it("matches country names", () => {
    const spanish = searchDestinations("ispanya").map((d) => d.cityCode);
    expect(spanish).toEqual(expect.arrayContaining(["BCN", "MAD", "SVQ"]));
    expect(searchDestinations("İSPANYA").map((d) => d.cityCode)).toEqual(spanish);
  });

  it("matches the start of words, not the middle", () => {
    expect(searchDestinations("ital").map((d) => d.cityCode).sort()).toEqual(["FLR", "MIL", "NAP", "ROM", "VCE"]);
    expect(first("dabi")).toBe("AUH");
  });

  it("knows everyday country names", () => {
    expect(searchDestinations("ingiltere").map((d) => d.cityCode).sort()).toEqual(["EDI", "LON"]);
    expect(first("abd")).toBe("NYC");
    expect(searchDestinations("BAE").map((d) => d.cityCode).sort()).toEqual(["AUH", "DXB"]);
  });

  it("ranks name prefixes before other matches", () => {
    expect(first("par")).toBe("PAR");
    expect(first("ro")).toBe("ROM");
  });

  it("returns every city for an empty query and nothing for nonsense", () => {
    expect(searchDestinations("")).toHaveLength(DESTINATIONS.length);
    expect(searchDestinations("   ")).toHaveLength(DESTINATIONS.length);
    expect(searchDestinations("qqqq")).toEqual([]);
  });
});
