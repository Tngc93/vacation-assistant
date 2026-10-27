import { describe, expect, it } from "vitest";
import { DESTINATIONS, findDestination, DISCOVER_CITY_CODES } from "./destinations";
import { ORIGINS } from "./origins";

const IATA = /^[A-Z]{3}$/;
const regionNames = new Intl.DisplayNames("tr", { type: "region" });
const currencies = new Set(Intl.supportedValuesOf("currency"));

describe("destinations data", () => {
  it("has about 60 cities", () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(55);
    expect(DESTINATIONS.length).toBeLessThanOrEqual(75);
  });

  it("has no duplicate city codes, Wikidata IDs or names", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(DESTINATIONS.map((d) => d.cityCode))).toBe(true);
    expect(unique(DESTINATIONS.map((d) => d.wikidataId))).toBe(true);
    expect(unique(DESTINATIONS.map((d) => d.nameTr))).toBe(true);
  });

  it("never assigns one airport to two cities", () => {
    const seen = new Map<string, string>();
    for (const d of DESTINATIONS) {
      for (const airport of d.airports) {
        expect(seen.get(airport), `${airport} in ${d.cityCode} and ${seen.get(airport)}`).toBeUndefined();
        seen.set(airport, d.cityCode);
      }
    }
  });

  it("does not list the departure cities as destinations", () => {
    const originAirports = ORIGINS.flatMap((o) => [o.code, ...o.airports]);
    for (const d of DESTINATIONS) {
      expect(originAirports).not.toContain(d.cityCode);
      for (const airport of d.airports) expect(originAirports).not.toContain(airport);
    }
  });

  it.each(DESTINATIONS.map((d) => [d.cityCode, d] as const))("%s has well-formed fields", (_, d) => {
    expect(d.cityCode).toMatch(IATA);
    expect(d.airports.length).toBeGreaterThan(0);
    for (const airport of d.airports) expect(airport).toMatch(IATA);
    expect(d.wikidataId).toMatch(/^Q[1-9]\d*$/);
    expect(d.lat).toBeGreaterThanOrEqual(-90);
    expect(d.lat).toBeLessThanOrEqual(90);
    expect(d.lon).toBeGreaterThanOrEqual(-180);
    expect(d.lon).toBeLessThanOrEqual(180);
    expect(d.radiusKm).toBeGreaterThanOrEqual(0.5);
    // Tokyo's guide reaches Shibuya and the Meiji Shrine from Nihonbashi.
    expect(d.radiusKm).toBeLessThanOrEqual(d.cityCode === "TYO" ? 7.5 : 5);
    expect(d.countryCode).toMatch(/^[A-Z]{2}$/);
    expect(d.countryTr).toBe(regionNames.of(d.countryCode));
    expect(currencies.has(d.currency), `${d.currency} is not an ISO 4217 code`).toBe(true);
    expect(() => new Intl.DateTimeFormat("en", { timeZone: d.timeZone })).not.toThrow();
    expect(d.nameTr.trim()).toBe(d.nameTr);
    expect(d.nameTr.length).toBeGreaterThan(1);
  });

  it("finds a destination by city code, case-insensitively", () => {
    expect(findDestination("bcn")?.nameTr).toBe("Barselona");
    expect(findDestination("LON")?.airports).toContain("LHR");
    expect(findDestination("XXX")).toBeUndefined();
  });
});

describe("discover cities", () => {
  it("are six distinct cities from the list", () => {
    expect(DISCOVER_CITY_CODES).toHaveLength(6);
    expect(new Set(DISCOVER_CITY_CODES).size).toBe(6);
    for (const code of DISCOVER_CITY_CODES) expect(findDestination(code), code).toBeDefined();
  });
});
