import { describe, expect, it } from "vitest";
import raw from "@/data/origins.json";
import { DESTINATIONS } from "@/data/destinations";
import { GET } from "@/app/api/origins/route";
import { DEFAULT_ORIGIN_CITY, findOrigin, ORIGIN_RESULTS, ORIGINS_COUNT, resolveOrigin, searchOrigins } from "./data";
import { originsFileSchema } from "./file";

const codes = (query: string) => searchOrigins(query).map((o) => o.code);
const airportsOf = (code: string) => findOrigin(code)?.airports.map((a) => a.code);

describe("origins data (src/data/origins.json)", () => {
  it("is a valid file with thousands of cities, each code once", () => {
    const file = originsFileSchema.parse(raw);
    expect(ORIGINS_COUNT).toBeGreaterThan(3000);
    expect(new Set(file.cities.map((c) => c.code)).size).toBe(file.cities.length);
    const airports = file.cities.flatMap((c) => c.airports.map((a) => a.code));
    expect(new Set(airports).size).toBe(airports.length);
    expect(file.sources.map((s) => s.terms)).toEqual(["Public Domain", "CC0 1.0", "CC BY 4.0"]);
    // Nothing derived from Travelpayouts' static data, which has no licence for redistribution.
    expect(JSON.stringify(raw)).not.toMatch(/travelpayouts/i);
  });

  it("never shows a missing translation or an empty name", () => {
    for (const city of originsFileSchema.parse(raw).cities) {
      expect(city.name).not.toBe("None");
      for (const a of city.airports) expect(a.name).not.toBe("None");
    }
  });

  it("groups a city's airports under its city code, real airports only", () => {
    expect(airportsOf("IST")).toEqual(["IST", "SAW"]);
    expect(airportsOf("LON")).toEqual(["LCY", "LGW", "LHR", "LTN", "SEN", "STN"]);
    expect(airportsOf("PAR")).toEqual(["BVA", "CDG", "ORY"]);
    expect(airportsOf("MOW")).toEqual(["DME", "SVO", "VKO", "ZIA"]);
    expect(airportsOf("NYC")).toEqual(["EWR", "JFK", "LGA"]);
    // Berlin's closed airports are not searched.
    expect(airportsOf("BER")).toEqual(["BER"]);
    // A one-airport city keeps its airport's code: Ankara is ESB, so old ?from=ESB links need no mapping.
    expect(airportsOf("ESB")).toEqual(["ESB"]);
    expect(findOrigin("ESB")?.name).toBe("Ankara");
  });

  it("names cities and airports in Turkish where Wikidata has it", () => {
    expect(findOrigin("IST")?.name).toBe("İstanbul");
    expect(findOrigin("LON")?.name).toBe("Londra");
    expect(findOrigin("MUC")?.name).toBe("Münih");
    expect(findOrigin("NYC")?.name).toBe("New York");
    expect(findOrigin("MAD")?.name).toBe("Madrid");
    expect(findOrigin("LON")?.countryName).toBe("Birleşik Krallık");
    expect(findOrigin("IST")?.timeZone).toBe("Europe/Istanbul");
    expect(findOrigin("LON")?.timeZone).toBe("Europe/London");
    expect(findOrigin("NYC")?.timeZone).toBe("America/New_York");
    expect(findOrigin("IST")?.airports.map((a) => a.name)).toEqual(["İstanbul Havalimanı", "Sabiha Gökçen Havalimanı"]);
    expect(findOrigin("LON")?.airports.find((a) => a.code === "LGW")?.name).toBe("Londra Gatwick Havalimanı");
  });

  it("uses the destination names the rest of the app uses for our 68 cities", () => {
    for (const d of DESTINATIONS) expect(findOrigin(d.cityCode)?.name, d.cityCode).toBe(d.nameTr);
  });
});

describe("findOrigin and resolveOrigin", () => {
  it("finds a city by its code, or by one of its airports (old links)", () => {
    expect(findOrigin("IST")?.code).toBe("IST");
    expect(findOrigin("saw")?.code).toBe("IST");
    expect(findOrigin("ESB")?.code).toBe("ESB");
    expect(findOrigin("ADB")?.name).toBe("İzmir");
    expect(findOrigin("LHR")?.code).toBe("LON");
    expect(findOrigin("ZZZ")).toBeUndefined();
    expect(findOrigin("")).toBeUndefined();
  });

  it("falls back to İstanbul for an unknown origin", () => {
    expect(DEFAULT_ORIGIN_CITY.code).toBe("IST");
    expect(resolveOrigin("ZZZ").code).toBe("IST");
    expect(resolveOrigin(undefined).code).toBe("IST");
    expect(resolveOrigin("ESB").name).toBe("Ankara");
  });
});

describe("searchOrigins", () => {
  it.each(["istanbul", "İstanbul", "ISTANBUL", "Istanbul", "İST", "ist"])("finds İstanbul first for %s", (q) => {
    expect(codes(q)[0]).toBe("IST");
  });

  it.each(["izmir", "İzmir", "IZMIR", "ADB"])("finds İzmir first for %s", (q) => {
    expect(codes(q)[0]).toBe("ADB");
  });

  it.each(["münih", "munih", "munchen", "München", "Munich", "MUC"])("finds Munich first for %s (Turkish, local and English names)", (q) => {
    expect(codes(q)[0]).toBe("MUC");
  });

  it.each([
    ["LON", "LON"],
    ["lhr", "LON"],
    ["londra", "LON"],
    ["london", "LON"],
    ["NYC", "NYC"],
    ["jfk", "NYC"],
    ["new york", "NYC"],
    ["esb", "ESB"],
    ["ankara", "ESB"],
    ["berlin", "BER"],
    ["roma", "ROM"],
    ["paris", "PAR"],
  ])("%s → %s", (q, code) => {
    expect(codes(q)[0]).toBe(code);
  });

  it("ranks the better known city first among names with the same start", () => {
    expect(codes("ber")[0]).toBe("BER");
    expect(codes("lon")[0]).toBe("LON");
  });

  it("finds a country's cities", () => {
    const german = searchOrigins("almanya");
    expect(german.length).toBe(ORIGIN_RESULTS);
    expect(german.map((o) => o.code)).toContain("BER");
  });

  it("returns well-known cities for an empty query and nothing for gibberish", () => {
    expect(searchOrigins("")).toHaveLength(ORIGIN_RESULTS);
    expect(codes("")).toContain("LON");
    expect(searchOrigins("qqqqqq")).toEqual([]);
  });

  it("returns plain rows: code, Turkish name and country, airport codes", () => {
    expect(searchOrigins("IST")[0]).toEqual({ code: "IST", name: "İstanbul", countryName: "Türkiye", airports: ["IST", "SAW"] });
    expect(searchOrigins("IST", undefined, "en")[0]).toEqual({ code: "IST", name: "Istanbul", countryName: "Türkiye", airports: ["IST", "SAW"] });
  });
});

describe("GET /api/origins", () => {
  it("answers a query with a handful of rows", async () => {
    const res = GET(new Request("http://localhost/api/origins?q=londra"));
    expect(res.headers.get("cache-control")).toContain("max-age");
    const json = (await res.json()) as { results: Array<{ code: string }> };
    expect(json.results[0].code).toBe("LON");
    expect(json.results.length).toBeLessThanOrEqual(ORIGIN_RESULTS);
  });

  it("answers without a query too", async () => {
    const json = (await GET(new Request("http://localhost/api/origins")).json()) as { results: unknown[] };
    expect(json.results).toHaveLength(ORIGIN_RESULTS);
  });
});
