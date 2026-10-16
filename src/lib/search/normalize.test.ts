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

  // Regression: substring matching once let "ital" find Brussels ("Brussels-Capital Region").
  it("returns only Italian cities for 'ital'", () => {
    const italian = DESTINATIONS.filter((d) => d.countryCode === "IT").map((d) => d.cityCode).sort();
    expect(searchDestinations("ital").map((d) => d.cityCode).sort()).toEqual(italian);
    expect(searchDestinations("ital").every((d) => d.countryCode === "IT")).toBe(true);
  });

  it("matches the start of words separated by spaces or hyphens, never the middle", () => {
    expect(first("dabi")).toBe("AUH");
    expect(first("lumpur")).toBe("KUL");
    expect(first("peterburg")).toBe("LED");
    expect(first("hersek")).toBe("SJJ");
    expect(searchDestinations("lona")).toEqual([]);
    expect(searchDestinations("peste")).toEqual([]);
    expect(searchDestinations("kahir").map((d) => d.cityCode)).toEqual(["CAI"]);
    expect(searchDestinations("ahire")).toEqual([]);
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
