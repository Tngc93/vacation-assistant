import { describe, expect, it } from "vitest";
import { buildOrigins, matchWikidataCity, type BuildInput, type WdLabels } from "./build";
import { labelsQuery, parseLabels } from "./source";

const city = (code: string, name: string, extra: Partial<BuildInput["cities"][number]> = {}) => ({
  code,
  name,
  country_code: "XX",
  time_zone: "Europe/Istanbul",
  has_flightable_airport: true,
  ...extra,
});
const airport = (code: string, cityCode: string, extra: Partial<BuildInput["airports"][number]> = {}) => ({
  code,
  city_code: cityCode,
  iata_type: "airport",
  flightable: true,
  name: `${code} Airport`,
  ...extra,
});
const labels = (entries: Record<string, Partial<WdLabels>>) =>
  new Map(Object.entries(entries).map(([qid, l]) => [qid, { native: [], sitelinks: 0, ...l }]));

function input(overrides: Partial<BuildInput>): BuildInput {
  return {
    cities: [],
    citiesTr: new Map(),
    airports: [],
    airportsTr: new Map(),
    served: [],
    labels: new Map(),
    destinations: [],
    fetchedAt: "2026-10-29T00:00:00Z",
    ...overrides,
  };
}

describe("buildOrigins", () => {
  it("keeps only cities with flightable airports, and only real airports", () => {
    const file = buildOrigins(
      input({
        cities: [city("AAA", "Alpha"), city("BBB", "Beta", { has_flightable_airport: false }), city("ССС", "Cyrillic"), city("DDD", "Delta")],
        airports: [
          airport("AAA", "AAA"),
          airport("AAR", "AAA", { iata_type: "railway" }),
          airport("AAX", "AAA", { flightable: false }),
          airport("BBB", "BBB"),
          airport("ССС", "ССС"),
          airport("DDH", "DDD", { iata_type: "heliport" }),
        ],
      }),
    );
    expect(file.cities.map((c) => [c.code, c.airports.map((a) => a.code)])).toEqual([["AAA", ["AAA"]]]);
  });

  it("names a city: destination, then Wikidata Turkish label, then Travelpayouts Turkish, then English; never 'None'", () => {
    const file = buildOrigins(
      input({
        cities: [city("DST", "Dest"), city("WDT", "Wiki"), city("TPT", "Tp"), city("ENG", "English"), city("NON", "Nothing")],
        citiesTr: new Map([
          ["WDT", "Wrong"],
          ["TPT", "Tépé"],
          ["NON", "None"],
        ]),
        airports: ["DST", "WDT", "TPT", "ENG", "NON"].map((c) => airport(c, c)),
        served: [{ iata: "WDT", qid: "Q1" }],
        labels: labels({ Q1: { en: "Wiki", tr: "Viki" } }),
        destinations: [{ cityCode: "DST", nameTr: "Hedef", nameEn: "Dest" }],
      }),
    );
    const names = Object.fromEntries(file.cities.map((c) => [c.code, c.name]));
    expect(names).toEqual({ DST: "Hedef", WDT: "Viki", TPT: "Tépé", ENG: "English", NON: "Nothing" });
    // Other names stay searchable.
    expect(file.cities.find((c) => c.code === "WDT")?.aliases).toEqual(["Wiki", "Wrong"]);
  });

  it("uses Travelpayouts' Turkish airport names when there are some", () => {
    const file = buildOrigins(
      input({
        cities: [city("IST", "Istanbul")],
        airports: [airport("SAW", "IST", { name: "Sabiha Gokcen" }), airport("IST", "IST", { name: "Istanbul New Airport" })],
        airportsTr: new Map([
          ["IST", "İstanbul Havalimanı"],
          ["SAW", "None"],
        ]),
      }),
    );
    expect(file.cities[0].airports).toEqual([
      { code: "IST", name: "İstanbul Havalimanı" },
      { code: "SAW", name: "Sabiha Gokcen" },
    ]);
  });

  it("puts better known cities first (Wikipedia languages)", () => {
    const file = buildOrigins(
      input({
        cities: [city("SML", "Small"), city("BIG", "Big")],
        airports: [airport("SML", "SML"), airport("BIG", "BIG")],
        served: [
          { iata: "SML", qid: "Q1" },
          { iata: "BIG", qid: "Q2" },
        ],
        labels: labels({ Q1: { en: "Small", sitelinks: 5 }, Q2: { en: "Big", sitelinks: 200 } }),
      }),
    );
    expect(file.cities.map((c) => c.code)).toEqual(["BIG", "SML"]);
  });
});

describe("matchWikidataCity", () => {
  const l = labels({
    Q60: { en: "New York City", tr: "New York", sitelinks: 300 },
    Q1: { en: "York", sitelinks: 100 },
    Q2: { en: "Elizabeth", sitelinks: 50 },
    Q1726: { en: "Munich", tr: "Münih", native: ["München"], sitelinks: 250 },
  });

  it("accepts the airport's served place only when its name is the city's", () => {
    expect(matchWikidataCity({ en: "New York", tr: null }, ["Q2", "Q60"], l)).toBe("Q60");
    expect(matchWikidataCity({ en: "Muenchen", tr: "Münih" }, ["Q1726"], l)).toBe("Q1726");
    expect(matchWikidataCity({ en: "Golgen", tr: null }, ["Q2"], l)).toBeNull();
  });

  it("never matches a longer city name to a shorter place ('New York' is not 'York')", () => {
    expect(matchWikidataCity({ en: "New York", tr: null }, ["Q1"], l)).toBeNull();
  });
});

describe("Wikidata labels", () => {
  it("asks for Turkish, English and native labels and the Wikipedia count", () => {
    const q = labelsQuery(["Q60", "Q1726"]);
    expect(q).toContain("VALUES ?city { wd:Q60 wd:Q1726 }");
    expect(q).toContain('LANG(?tr) = "tr"');
    expect(q).toContain("wdt:P1705");
  });

  it("collects every native label of a place", () => {
    const b = (native: string) => ({
      city: { value: "http://www.wikidata.org/entity/Q1726" },
      tr: { value: "Münih" },
      en: { value: "Munich" },
      native: { value: native },
      links: { value: "250" },
    });
    expect(parseLabels({ results: { bindings: [b("München"), b("Minga")] } }).get("Q1726")).toEqual({
      tr: "Münih",
      en: "Munich",
      native: ["München", "Minga"],
      sitelinks: 250,
    });
  });
});
