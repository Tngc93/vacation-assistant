import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import museums from "./__fixtures__/overpass-museums.json";
import sitelinks from "./__fixtures__/wikidata-sitelinks.json";
import { buildCategoryEntry, looseName, mergeLandmarks, slimPlace } from "./build";
import { storedPlaceSchema } from "./file";
import { buildCityQuery, type Fetcher, type OverpassElement } from "./overpass";

const BCN = findDestination("BCN")!;
const elements = museums.elements as unknown as OverpassElement[];
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("buildCategoryEntry", () => {
  it("ranks by Wikipedia count and stores only what the UI needs", async () => {
    const fetcher: Fetcher = async () => reply(sitelinks);
    const entry = await buildCategoryEntry(BCN, "museum", elements, { fetcher });
    expect(entry.wikipediaCountsAvailable).toBe(true);
    expect(entry.places.map((p) => [p.name, p.wikipediaCount])).toEqual([
      ["Museu Nacional d'Art de Catalunya", 6],
      ["Picasso Müzesi", 4],
      ["Galeria Petita", undefined],
    ]);
    for (const place of entry.places) {
      expect(storedPlaceSchema.parse(place)).toEqual(place);
      expect(place).not.toHaveProperty("category");
    }
  });

  it("keeps the places but says so when Wikidata fails", async () => {
    const fetcher: Fetcher = async () => reply({}, 503);
    const entry = await buildCategoryEntry(BCN, "museum", elements, { fetcher });
    expect(entry.wikipediaCountsAvailable).toBe(false);
    expect(entry.places).toHaveLength(3);
  });

  it("drops places outside the city radius", async () => {
    const far: OverpassElement = { type: "node", id: 9, lat: 41.6, lon: 2.4, tags: { tourism: "museum", name: "Far away" } };
    const entry = await buildCategoryEntry(BCN, "museum", [far], { fetcher: async () => reply({ entities: {} }) });
    expect(entry.places).toEqual([]);
  });

  it("stores sights with their kinds and keeps the candidates the rules leave out, beyond the 40 shown", async () => {
    const el = (id: number, name: string, wikidata: string, extra: Record<string, string> = {}): OverpassElement => ({
      type: "node",
      id,
      lat: 41.3851,
      lon: 2.1734,
      tags: { name, wikidata, tourism: "attraction", ...extra },
    });
    const sights = [
      el(1, "Club", "Q1"),
      ...Array.from({ length: 45 }, (_, i) => el(100 + i, `Sight ${String(i).padStart(2, "0")}`, `Q${100 + i}`)),
    ];
    // Wikipedia counts put the club first; then Sight 00…44.
    const sitelinks = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}wiki`, {}]));
    const entities = Object.fromEntries([["Q1", { sitelinks: sitelinks(80) }], ...sights.slice(1).map((e, i) => [e.tags!.wikidata, { sitelinks: sitelinks(60 - i) }])]);
    const kinds = new Map([["Q1", ["nightclub"] as const], ["Q100", ["square"] as const]]);
    const entry = await buildCategoryEntry(BCN, "see", sights, { fetcher: async () => reply({ entities }), kinds });
    // 40 sights pass the rules, and the club ranked among them is kept too.
    expect(entry.places).toHaveLength(41);
    expect(entry.places[0]).toMatchObject({ name: "Club", kinds: ["nightclub"] });
    expect(entry.places[1]).toMatchObject({ name: "Sight 00", kinds: ["square"] });
    expect(entry.places.at(-1)?.name).toBe("Sight 39");
    for (const place of entry.places) expect(storedPlaceSchema.parse(place)).toEqual(place);
  });

  it("rounds coordinates to five decimals", () => {
    expect(slimPlace({ id: "node/1", category: "cafe", name: "X", lat: 41.123456789, lon: 2.987654321 })).toEqual({
      id: "node/1",
      name: "X",
      lat: 41.12346,
      lon: 2.98765,
    });
  });
});

describe("buildCityQuery", () => {
  it("asks for every category in one request, each with its own limit", () => {
    const query = buildCityQuery(41.3825, 2.1769, 3);
    expect(query.startsWith("[out:json][timeout:120][bbox:41.3556,2.141,41.4094,2.2128];")).toBe(true);
    expect(query.match(/out tags center 400;/g)).toHaveLength(8);
    expect(query).toContain('nwr["amenity"="nightclub"]["name"];');
    expect(query).not.toContain("~");
  });
});

describe("mergeLandmarks", () => {
  const landmark = (qid: string, name: string, lat: number, lon: number, extra: Partial<import("./landmarks").Landmark> = {}) => ({
    qid,
    name,
    lat,
    lon,
    distKm: 1,
    wikipedias: 40,
    countries: ["ES"],
    museum: false,
    ...extra,
  });
  const osm = [
    { id: "way/1", category: "see" as const, name: "Basílica de la Sagrada Família", lat: 41.4036, lon: 2.1744, wikidataId: "Q48435" },
    { id: "way/2", category: "museum" as const, name: "Museu Picasso", lat: 41.3852, lon: 2.1809 },
  ];

  it("joins by the OSM wikidata tag, then by a similar name within 150 m, and adds the rest", () => {
    const merged = mergeLandmarks(
      osm,
      [
        landmark("Q48435", "Sagrada Família", 41.4036, 2.1744),
        landmark("Q1050032", "Barselona Picasso Müzesi", 41.3853, 2.181, { enLabel: "Museu Picasso", museum: true }),
        landmark("Q461371", "Casa Batlló", 41.3916, 2.165),
      ],
      "ES",
    );
    expect(merged.qidFor).toEqual(new Map([["way/2", "Q1050032"]]));
    expect(merged.extras).toEqual([
      { id: "wikidata/Q461371", category: "see", name: "Casa Batlló", lat: 41.3916, lon: 2.165, wikidataId: "Q461371" },
    ]);
    expect(merged.counts.get("Q461371")).toBe(40);
  });

  it("does not join a similar name farther than 150 m, and marks a place in another country", () => {
    const merged = mergeLandmarks(
      osm,
      [landmark("Q9", "Museu Picasso", 41.39, 2.19), landmark("Q12512", "San Pietro Bazilikası", 41.9022, 12.4539, { countries: ["VA"] })],
      "ES",
    );
    expect(merged.qidFor.size).toBe(0);
    expect(merged.countryFor.size).toBe(0);
    expect(merged.extras.map((e) => [e.id, e.country])).toEqual([
      ["wikidata/Q9", undefined],
      ["wikidata/Q12512", "VA"],
    ]);
  });

  it("marks OSM places that are a landmark abroad, by tag or by name (St Peter's from Rome)", () => {
    const rome = [
      { id: "way/1", category: "see" as const, name: "Basilica di San Pietro", lat: 41.9022, lon: 12.4539, wikidataId: "Q12512" },
      { id: "way/2", category: "see" as const, name: "Cappella Sistina", lat: 41.9029, lon: 12.4545 },
      { id: "way/3", category: "see" as const, name: "Pantheon", lat: 41.8986, lon: 12.4769, wikidataId: "Q99309" },
    ];
    const merged = mergeLandmarks(
      rome,
      [
        landmark("Q12512", "San Pietro Bazilikası", 41.9022, 12.4539, { countries: ["VA"] }),
        landmark("Q51252", "Sistine Chapel", 41.9029, 12.4544, { countries: ["VA"], enLabel: "Cappella Sistina" }),
        landmark("Q99309", "Pantheon", 41.8986, 12.4769, { countries: ["IT"] }),
      ],
      "IT",
    );
    expect(merged.countryFor).toEqual(new Map([["way/1", "VA"], ["way/2", "VA"]]));
    expect(merged.extras).toEqual([]);
  });

  it("matches names regardless of accents and case", () => {
    expect(looseName("Casa Milà")).toBe(looseName("CASA MILA"));
  });
});
