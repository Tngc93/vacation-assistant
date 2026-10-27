import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { travelBetween } from "@/lib/itinerary/travel";
import { farCaption, farFromCentreKm, transitFromCentre } from "./far";
import type { PlacesFile, StoredPlace } from "./file";
import { applyPlaceRules } from "./rules";

// Barcelona's centre and Park Güell, 4 km to the north.
const CENTRE = { lat: 41.3825, lon: 2.1769 };
const GUELL = { lat: 41.41361, lon: 2.15278 };
const KM = distanceKm(CENTRE.lat, CENTRE.lon, GUELL.lat, GUELL.lon);

describe("farFromCentreKm: beyond the city's data radius", () => {
  it("is not far at exactly the radius, nor just inside it; it is far just outside it", () => {
    expect(farFromCentreKm(GUELL, CENTRE, KM)).toBeNull();
    expect(farFromCentreKm(GUELL, CENTRE, KM + 0.01)).toBeNull();
    expect(farFromCentreKm(GUELL, CENTRE, KM - 0.01)).toBeCloseTo(KM, 9);
    expect(farFromCentreKm(CENTRE, CENTRE, 3)).toBeNull();
  });

  it("reads 'MERKEZE UZAK · ~X KM' in whole kilometres, never ~0", () => {
    expect(farCaption(KM)).toBe("MERKEZE UZAK · ~4 KM");
    expect(farCaption(5.42)).toBe("MERKEZE UZAK · ~5 KM");
    expect(farCaption(0.4)).toBe("MERKEZE UZAK · ~1 KM");
  });

  it("suggests transport from the centre by the plan's walking rule (travel.ts), not by the radius", () => {
    // Malé's radius is 1 km: a place 1.5 km out is far, but still a walk.
    for (const km of [1.5, 2.99, 3, 3.01, KM]) {
      const lon = CENTRE.lon + km / (111.32 * Math.cos((CENTRE.lat * Math.PI) / 180));
      const exact = distanceKm(CENTRE.lat, CENTRE.lon, CENTRE.lat, lon);
      expect(transitFromCentre(exact)).toBe(travelBetween(CENTRE, { lat: CENTRE.lat, lon }).transit);
    }
  });
});

describe("applyPlaceRules marks far places", () => {
  const at = (id: string, lat: number, lon: number, extra: Partial<StoredPlace> = {}): StoredPlace => ({ id, name: id, lat, lon, ...extra });
  const file = (radiusKm: number, see: StoredPlace[], restaurant: StoredPlace[] = []) =>
    ({
      version: 5,
      cityCode: "BCN",
      radiusKm,
      categories: {
        see: { status: "ok", wikipediaCountsAvailable: true, places: see },
        restaurant: { status: "ok", wikipediaCountsAvailable: false, places: restaurant },
      },
    }) as unknown as PlacesFile;
  const shown = (f: ReturnType<typeof applyPlaceRules>, id: string) =>
    Object.values(f.categories).flatMap((c) => (c.status === "ok" ? c.places : [])).find((p) => p.id === id);

  it("uses the destination's coordinate as the centre and the file's radius, in every category", () => {
    const guell = at("way/1", GUELL.lat, GUELL.lon, { wikidataId: "Q207870", kinds: ["attraction"] });
    const dinner = at("node/2", GUELL.lat, GUELL.lon);
    const result = applyPlaceRules(file(3, [guell], [dinner]), {}, CENTRE);
    expect(shown(result, "way/1")?.farKm).toBe(4);
    expect(shown(result, "node/2")?.farKm).toBe(4);
    // A larger radius: the same place is not far.
    expect(shown(applyPlaceRules(file(KM + 0.01, [guell]), {}, CENTRE), "way/1")?.farKm).toBeUndefined();
    // By default the centre is the destination's (destinations.ts): Barcelona.
    expect(shown(applyPlaceRules(file(3, [guell])), "way/1")?.farKm).toBeGreaterThan(3);
  });

  it("gives a place inside another shown place that place's value, whatever its own distance", () => {
    const park = at("way/1", GUELL.lat, GUELL.lon, { wikidataId: "Q207870", kinds: ["attraction"] });
    // Inside the park, but a few metres within the radius by its own point: it still goes with the park.
    const house = at("way/3", GUELL.lat - 0.0002, GUELL.lon, { wikidataId: "Q3", kinds: ["museum"], parentId: "Q207870", parentName: "Güell Parkı" });
    const result = applyPlaceRules(file(KM - 0.005, [park, house]), {}, CENTRE);
    expect(shown(result, "way/1")?.farKm).toBe(4);
    expect(shown(result, "way/3")?.farKm).toBe(shown(result, "way/1")?.farKm);
    // A central parent: its child is not far either, even past the radius.
    const centralParent = at("way/4", CENTRE.lat, CENTRE.lon, { wikidataId: "Q4", kinds: ["attraction"] });
    const outlier = at("way/5", GUELL.lat, GUELL.lon, { wikidataId: "Q5", kinds: ["attraction"], parentId: "Q4" });
    expect(shown(applyPlaceRules(file(3, [centralParent, outlier]), {}, CENTRE), "way/5")?.farKm).toBeUndefined();
  });
});
