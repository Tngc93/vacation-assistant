import { describe, expect, it } from "vitest";
import { DESTINATIONS, findDestination } from "./destinations";
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
    expect(d.radiusKm).toBeLessThanOrEqual(5);
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
