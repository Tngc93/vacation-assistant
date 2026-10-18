import { describe, expect, it } from "vitest";
import { distanceKm } from "./overpass";
import { nameKey, SAME_NAME_KM, sameNameOnce } from "./twins";

const at = (id: string, name: string, lat: number, lon: number) => ({ id, name, lat, lon });

describe("sameNameOnce", () => {
  it("merges one place mapped as several OSM objects, keeping the first", () => {
    const places = [
      at("way/1", "La Rambla", 41.3809, 2.1735),
      at("node/2", "Sagrada Família", 41.4036, 2.1744),
      at("way/3", "La Rambla", 41.3841, 2.1706),
      at("way/4", "la  rambla ", 41.3786, 2.1753),
    ];
    expect(sameNameOnce(places).map((p) => p.id)).toEqual(["way/1", "node/2"]);
  });

  it("keeps places with the same name that are far apart", () => {
    // Two different viewpoints that share a generic name, about 3 km apart.
    const places = [at("node/1", "Mirador", 41.37, 2.17), at("node/2", "Mirador", 41.397, 2.17)];
    expect(distanceKm(41.37, 2.17, 41.397, 2.17)).toBeGreaterThan(SAME_NAME_KM);
    expect(sameNameOnce(places)).toEqual(places);
  });

  it("treats two OSM objects pointing to one Wikidata item as one place", () => {
    const forum = { ...at("way/1", "Forum Romanum", 41.8925, 12.4853), wikidataId: "Q180212" };
    const square = { ...at("way/2", "Piazza del Foro", 41.8931, 12.486), wikidataId: "Q180212" };
    expect(sameNameOnce([forum, square, at("node/3", "Pantheon", 41.8986, 12.4769)]).map((p) => p.id)).toEqual(["way/1", "node/3"]);
  });

  it("keeps the given order and drops repeated ids", () => {
    const places = [at("node/3", "C", 0, 0), at("node/1", "A", 0, 0), at("node/3", "C", 0, 0), at("node/2", "B", 0, 0)];
    expect(sameNameOnce(places).map((p) => p.name)).toEqual(["C", "A", "B"]);
  });

  it("compares names with Turkish lowercase rules", () => {
    expect(nameKey(at("node/1", "İSTİKLAL  Caddesi", 0, 0))).toBe(nameKey(at("node/2", "istiklal caddesi", 0, 0)));
    expect(nameKey(at("node/1", "IŞIK", 0, 0))).not.toBe(nameKey(at("node/2", "işik", 0, 0)));
  });
});
