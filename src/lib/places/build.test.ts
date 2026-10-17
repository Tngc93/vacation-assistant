import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import museums from "./__fixtures__/overpass-museums.json";
import sitelinks from "./__fixtures__/wikidata-sitelinks.json";
import { buildCategoryEntry, slimPlace } from "./build";
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
      expect(place).not.toHaveProperty("wikidataId");
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
