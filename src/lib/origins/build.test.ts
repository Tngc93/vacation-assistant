import { describe, expect, it } from "vitest";
import { buildOrigins, groupAirports, matchServedPlace, municipalityParts, timeZoneFor, type BuildInput, type OaAirport, type WdPlace } from "./build";
import { labelsQuery, parseCsv, parseGeoNames, parseLabels, parseOurAirports, pickAirportItems, unzipSingle } from "./source";
import { deflateRawSync } from "node:zlib";

const airport = (iata: string, extra: Partial<OaAirport> = {}): OaAirport => ({
  iata,
  type: "large_airport",
  name: `${iata} Airport`,
  lat: 41,
  lon: 29,
  country: "TR",
  region: "TR-34",
  municipality: "Istanbul",
  scheduled: true,
  ...extra,
});
const place = (qid: string, l: Partial<WdPlace>): [string, WdPlace] => [qid, { qid, native: [], sitelinks: 0, ...l }];
const GEO = [
  { lat: 41.01, lon: 28.97, country: "TR", timeZone: "Europe/Istanbul" },
  { lat: 51.5, lon: -0.12, country: "GB", timeZone: "Europe/London" },
  { lat: 43.8, lon: 87.6, country: "CN", timeZone: "Asia/Urumqi" },
];

function input(overrides: Partial<BuildInput>): BuildInput {
  return { airports: [], places: GEO, wdAirports: [], wdPlaces: new Map(), destinations: [], metros: [], fetchedAt: "2026-10-29T00:00:00Z", ...overrides };
}

describe("groupAirports", () => {
  it("keeps scheduled large and medium airports with an IATA code only", () => {
    const groups = groupAirports(
      input({
        airports: [
          airport("AAA", { municipality: "Alpha" }),
          airport("BBB", { municipality: "Beta", scheduled: false }),
          airport("CCC", { municipality: "Gamma", type: "small_airport" }),
          airport("DDD", { municipality: "Delta", type: "heliport" }),
          airport("EEE", { municipality: "Epsilon", type: "medium_airport" }),
        ],
      }),
    );
    expect(groups.map((g) => g.code)).toEqual(["AAA", "EEE"]);
  });

  it("puts a metro area's airports under its code, a destination's under its city code", () => {
    const groups = groupAirports(
      input({
        airports: [airport("IST"), airport("SAW", { municipality: "Pendik, Istanbul" }), airport("LHR", { country: "GB" }), airport("STN", { country: "GB", municipality: "London, Essex" })],
        metros: [{ code: "IST", qid: "Q406", nameEn: "Istanbul", airports: ["IST", "SAW"] }],
        destinations: [{ cityCode: "LON", nameTr: "Londra", nameEn: "London", wikidataId: "Q84", airports: ["LHR", "STN"] }],
      }),
    );
    expect(groups.map((g) => [g.code, g.airports.map((a) => a.iata)])).toEqual([
      ["LON", ["LHR", "STN"]],
      ["IST", ["IST", "SAW"]],
    ]);
  });

  it("groups the rest by municipality, country and region, within 100 km", () => {
    const groups = groupAirports(
      input({
        airports: [
          airport("IAH", { country: "US", region: "US-TX", municipality: "Houston", lat: 29.98, lon: -95.34 }),
          airport("HOU", { country: "US", region: "US-TX", municipality: "Houston", lat: 29.65, lon: -95.28, type: "medium_airport" }),
          // Two Albanys in two states are two cities.
          airport("ALB", { country: "US", region: "US-NY", municipality: "Albany", lat: 42.75, lon: -73.8 }),
          airport("ABY", { country: "US", region: "US-GA", municipality: "Albany", lat: 31.53, lon: -84.19, type: "medium_airport" }),
          // Same name, same region, far apart.
          airport("XAA", { country: "US", region: "US-TX", municipality: "Houston", lat: 33.0, lon: -97.0, type: "medium_airport" }),
        ],
      }),
    );
    expect(groups.map((g) => [g.code, g.airports.map((a) => a.iata)])).toEqual([
      ["ALB", ["ALB"]],
      ["IAH", ["IAH", "HOU"]],
      ["ABY", ["ABY"]],
      ["XAA", ["XAA"]],
    ]);
  });

  it("refuses a metro code that is another city's airport code", () => {
    expect(() =>
      groupAirports(input({ airports: [airport("ROM", { municipality: "Elsewhere" }), airport("FCO", { country: "IT" })], metros: [{ code: "ROM", qid: "Q220", nameEn: "Rome", airports: ["FCO"] }] })),
    ).toThrow(/ROM/);
  });
});

describe("buildOrigins", () => {
  it("names cities and airports from Wikidata (Turkish, then English), else OurAirports; never makes one up", () => {
    const file = buildOrigins(
      input({
        airports: [
          airport("IST", { name: "İstanbul Airport" }),
          airport("SAW", { municipality: "Pendik, Istanbul", name: "Istanbul Sabiha Gökçen International Airport" }),
          airport("ADB", { municipality: "Gaziemir", name: "Adnan Menderes International Airport", lat: 38.29, lon: 27.15 }),
          airport("XXX", { municipality: "Nowhere", name: "Nowhere Field", lat: 40, lon: 30 }),
        ],
        metros: [{ code: "IST", qid: "Q406", nameEn: "Istanbul", airports: ["IST", "SAW"] }],
        wdAirports: [
          { iata: "IST", qid: "Q1", tr: "İstanbul Havalimanı", en: "Istanbul Airport", sitelinks: 40, served: ["Q406"] },
          { iata: "SAW", qid: "Q2", en: "Sabiha Gökçen Airport", sitelinks: 30, served: ["Q406"] },
          // İzmir is the one place ADB serves, 15 km away; the municipality (Gaziemir) is a district.
          { iata: "ADB", qid: "Q3", tr: "Adnan Menderes Havalimanı", sitelinks: 20, served: ["Q35997"] },
        ],
        wdPlaces: new Map([place("Q406", { tr: "İstanbul", en: "Istanbul", sitelinks: 200 }), place("Q35997", { tr: "İzmir", en: "İzmir", sitelinks: 150, lat: 38.42, lon: 27.14 })]),
      }),
    );
    expect(file.cities.map((c) => [c.code, c.name, c.airports])).toEqual([
      [
        "IST",
        "İstanbul",
        [
          { code: "IST", name: "İstanbul Havalimanı", nameEn: "Istanbul Airport" },
          { code: "SAW", name: "Sabiha Gökçen Airport" },
        ],
      ],
      // No English label: OurAirports' (English) name.
      ["ADB", "İzmir", [{ code: "ADB", name: "Adnan Menderes Havalimanı", nameEn: "Adnan Menderes International Airport" }]],
      ["XXX", "Nowhere", [{ code: "XXX", name: "Nowhere Field" }]],
    ]);
    // English city names only where they differ ("İzmir" is the same in both).
    expect(file.cities.map((c) => c.nameEn)).toEqual(["Istanbul", undefined, undefined]);
    expect(file.cities[1].aliases).toEqual(["Gaziemir"]);
    expect(file.sources.map((s) => s.terms)).toEqual(["Public Domain", "CC0 1.0", "CC BY 4.0"]);
    expect(JSON.stringify(file)).not.toMatch(/travelpayouts/i);
  });

  it("uses a destination's own name and Wikidata item", () => {
    const file = buildOrigins(
      input({
        airports: [airport("LHR", { country: "GB", lat: 51.47, lon: -0.45, municipality: "London" })],
        destinations: [{ cityCode: "LON", nameTr: "Londra", nameEn: "London", wikidataId: "Q84", airports: ["LHR"], aliases: ["İngiltere"] }],
        wdPlaces: new Map([place("Q84", { tr: "Londra", en: "London", native: ["London"], sitelinks: 300 })]),
      }),
    );
    expect(file.cities[0]).toMatchObject({ code: "LON", name: "Londra", timeZone: "Europe/London", aliases: ["London", "İngiltere"] });
  });
});

describe("matchServedPlace", () => {
  const places = new Map([
    place("Q60", { en: "New York City", tr: "New York", sitelinks: 300, lat: 40.71, lon: -74 }),
    place("Q1", { en: "York", sitelinks: 100, lat: 53.96, lon: -1.08 }),
    place("Q2", { en: "Elizabeth", sitelinks: 50, lat: 40.66, lon: -74.21 }),
  ]);
  const jfk = { lat: 40.64, lon: -73.78 };

  it("takes the served place whose name is the municipality's", () => {
    expect(matchServedPlace(["New York"], ["Q2", "Q60"], places, jfk)).toBe("Q60");
  });

  it("never matches a longer name to a shorter place ('New York' is not 'York')", () => {
    expect(matchServedPlace(["New York"], ["Q1"], places, jfk)).toBeNull();
  });

  it("takes the only served place when it is close, not when it is far", () => {
    expect(matchServedPlace(["Gaziemir"], ["Q2"], places, jfk)).toBe("Q2");
    expect(matchServedPlace(["Gaziemir"], ["Q1"], places, jfk)).toBeNull();
  });
});

describe("time zones", () => {
  const byCountry = new Map<string, typeof GEO>();
  for (const p of GEO) byCountry.set(p.country, [...(byCountry.get(p.country) ?? []), p]);

  it("take the nearest GeoNames place in the same country", () => {
    expect(timeZoneFor(airport("SAW", { lat: 40.9, lon: 29.3 }), byCountry)).toBe("Europe/Istanbul");
    expect(timeZoneFor(airport("LHR", { country: "GB" }), byCountry)).toBe("Europe/London");
    expect(timeZoneFor(airport("ZZZ", { country: "ZZ" }), byCountry)).toBeNull();
  });

  it("keep China on Beijing time, as its airports do", () => {
    expect(timeZoneFor(airport("URC", { country: "CN", lat: 43.9, lon: 87.47 }), byCountry)).toBe("Asia/Shanghai");
  });
});

describe("sources", () => {
  it("parse OurAirports' CSV, quotes and commas included", () => {
    const csv =
      '"id","ident","type","name","latitude_deg","longitude_deg","iso_country","iso_region","municipality","scheduled_service","iata_code"\n' +
      '1,"LTFM","large_airport","İstanbul Airport",41.26,28.74,"TR","TR-34","Istanbul","yes","IST"\n' +
      '2,"X","medium_airport","Paris ""Orly"" Airport",48.7,2.4,"FR","FR-IDF","Paris (Orly, Val-de-Marne)","yes","ory"\n' +
      '3,"Y","small_airport","No Code",1,1,"FR","FR-IDF","","no",""\n';
    expect(parseCsv('a,"b,c",d\n')).toEqual([["a", "b,c", "d"]]);
    expect(parseOurAirports(csv)).toEqual([
      { iata: "IST", type: "large_airport", name: "İstanbul Airport", lat: 41.26, lon: 28.74, country: "TR", region: "TR-34", municipality: "Istanbul", scheduled: true },
      { iata: "ORY", type: "medium_airport", name: 'Paris "Orly" Airport', lat: 48.7, lon: 2.4, country: "FR", region: "FR-IDF", municipality: "Paris (Orly, Val-de-Marne)", scheduled: true },
    ]);
    expect(municipalityParts("Paris (Orly, Val-de-Marne)")).toEqual(["Paris", "Orly", "Val-de-Marne"]);
    expect(municipalityParts("Ferno (VA)")).toEqual(["Ferno"]);
  });

  it("read GeoNames' zip without a zip library", () => {
    const text = Buffer.from("745044\tIstanbul\tIstanbul\t\t41.01384\t28.94966\tP\tPPLA\tTR\t\t34\t\t\t\t15701602\t\t39\tEurope/Istanbul\t2025-01-01\n");
    const data = deflateRawSync(text);
    const name = Buffer.from("cities1000.txt");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(text.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(text.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 42);
    const cdStart = local.length + name.length + data.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length + name.length, 12);
    eocd.writeUInt32LE(cdStart, 16);
    const zip = Buffer.concat([local, name, data, central, name, eocd]);
    expect(parseGeoNames(unzipSingle(zip, "cities1000.txt").toString("utf8"))).toEqual([{ lat: 41.01384, lon: 28.94966, country: "TR", timeZone: "Europe/Istanbul" }]);
  });

  it("ask Wikidata for labels, native names, coordinates and the Wikipedia count", () => {
    const q = labelsQuery(["Q60", "Q1726"]);
    expect(q).toContain("VALUES ?item { wd:Q60 wd:Q1726 }");
    expect(q).toContain('LANG(?tr) = "tr"');
    expect(q).toContain("wdt:P1705");
    expect(q).toContain("wdt:P625");
    const b = (native: string) => ({
      item: { value: "http://www.wikidata.org/entity/Q1726" },
      tr: { value: "Münih" },
      en: { value: "Munich" },
      native: { value: native },
      links: { value: "250" },
      coord: { value: "Point(11.575 48.1375)" },
    });
    expect(parseLabels({ results: { bindings: [b("München"), b("Minga")] } }).get("Q1726")).toEqual({
      qid: "Q1726",
      tr: "Münih",
      en: "Munich",
      native: ["München", "Minga"],
      sitelinks: 250,
      lat: 48.1375,
      lon: 11.575,
    });
  });

  it("pick the best known Wikidata item for an IATA code (a closed namesake loses)", () => {
    const labels = new Map([place("Q1", { tr: "Yeni", sitelinks: 40 }), place("Q2", { en: "Old", sitelinks: 5 })]);
    const picked = pickAirportItems(
      [
        { iata: "BER", qid: "Q2", served: new Set(["Q64"]) },
        { iata: "BER", qid: "Q1", served: new Set(["Q64"]) },
      ],
      labels,
    );
    expect(picked).toEqual([{ iata: "BER", qid: "Q1", tr: "Yeni", en: undefined, sitelinks: 40, served: ["Q64"] }]);
  });
});
