import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { travelBetween } from "@/lib/itinerary/travel";
import { FAR_MIN_KM, farCaption, farFromCentreKm, transitFromCentre } from "./far";
import type { PlacesFile, StoredPlace } from "./file";
import { applyPlaceRules } from "./rules";
import { EN, TR } from "@/test/i18n";

// Barcelona's centre (destinations.ts), and points due east of it at a given straight-line distance.
const CENTRE = { lat: 41.3825, lon: 2.1769 };
const east = (km: number) => {
  const lon = CENTRE.lon + km / (111.32 * Math.cos((CENTRE.lat * Math.PI) / 180));
  return { lat: CENTRE.lat, lon };
};
const kmTo = (p: { lat: number; lon: number }) => distanceKm(CENTRE.lat, CENTRE.lon, p.lat, p.lon);
// Park Güell, 4.0 km north: beyond Barcelona's 3 km radius, but within 5 km, so not far.
const GUELL = { lat: 41.41361, lon: 2.15278 };

describe("farFromCentreKm: beyond the larger of the city's data radius and 5 km", () => {
  it("never calls a place within 5 km far, however small the radius: 4.9 km is not far, 5.1 km is", () => {
    expect(FAR_MIN_KM).toBe(5);
    expect(farFromCentreKm(east(4.9), CENTRE, 3)).toBeNull();
    expect(farFromCentreKm(east(5.1), CENTRE, 3)).toBeCloseTo(kmTo(east(5.1)), 9);
    expect(farFromCentreKm(GUELL, CENTRE, 3)).toBeNull();
    expect(farFromCentreKm(CENTRE, CENTRE, 1)).toBeNull();
  });

  it("is not far at exactly the threshold, nor just inside it; it is far just outside it", () => {
    // The 5 km floor…
    const five = east(5);
    expect(farFromCentreKm(five, CENTRE, 3)).toBeNull();
    expect(farFromCentreKm(five, CENTRE, kmTo(five) - 0.01)).toBeNull();
    // …and a radius larger than it (Tokyo's 7.5 km).
    const place = east(7.6);
    const km = kmTo(place);
    expect(farFromCentreKm(place, CENTRE, km)).toBeNull();
    expect(farFromCentreKm(place, CENTRE, km + 0.01)).toBeNull();
    expect(farFromCentreKm(place, CENTRE, km - 0.01)).toBeCloseTo(km, 9);
  });

  it("reads 'MERKEZE ~X KM' in whole kilometres (neutral, no UZAK)", () => {
    expect(farCaption(5.42, TR)).toBe("MERKEZE ~5 KM");
    expect(farCaption(5.9, TR)).toBe("MERKEZE ~6 KM");
    expect(farCaption(0.4, TR)).toBe("MERKEZE ~1 KM");
    expect(farCaption(5.9, EN)).toBe("~6 KM FROM CENTRE");
  });

  it("suggests transport from the centre by the plan's walking rule (travel.ts)", () => {
    for (const km of [1.5, 2.99, 3, 3.01, 5.1]) {
      const point = east(km);
      expect(transitFromCentre(kmTo(point))).toBe(travelBetween(CENTRE, point).transit);
    }
  });
});

describe("applyPlaceRules marks far places", () => {
  const at = (id: string, p: { lat: number; lon: number }, extra: Partial<StoredPlace> = {}): StoredPlace => ({ id, name: id, ...p, ...extra });
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

  it("uses the destination's centre and the file's radius, in every category", () => {
    const sight = at("way/1", east(6), { wikidataId: "Q1", kinds: ["attraction"] });
    const dinner = at("node/2", east(6));
    const guell = at("way/3", GUELL, { wikidataId: "Q207870", kinds: ["attraction"] });
    const result = applyPlaceRules(file(3, [sight, guell], [dinner]), {}, CENTRE);
    expect(shown(result, "way/1")?.farKm).toBe(6);
    expect(shown(result, "node/2")?.farKm).toBe(6);
    expect(shown(result, "way/3")?.farKm).toBeUndefined();
    // A radius larger than the place's distance: not far.
    expect(shown(applyPlaceRules(file(6.1, [sight]), {}, CENTRE), "way/1")?.farKm).toBeUndefined();
    // By default the centre is the destination's (destinations.ts `cityCentre`): Barcelona.
    expect(shown(applyPlaceRules(file(3, [sight])), "way/1")?.farKm).toBeGreaterThan(5);
  });

  it("gives a place inside another shown place that place's value, whatever its own distance", () => {
    const park = at("way/1", east(6), { wikidataId: "Q10", kinds: ["attraction"] });
    // Inside the park, but within 5 km by its own point: it still goes with the park.
    const house = at("way/3", east(4.95), { wikidataId: "Q3", kinds: ["museum"], parentId: "Q10", parentName: "Park" });
    const result = applyPlaceRules(file(3, [park, house]), {}, CENTRE);
    expect(shown(result, "way/1")?.farKm).toBe(6);
    expect(shown(result, "way/3")?.farKm).toBe(6);
    // A central parent: its child is not far either, even past 5 km.
    const centralParent = at("way/4", CENTRE, { wikidataId: "Q4", kinds: ["attraction"] });
    const outlier = at("way/5", east(6), { wikidataId: "Q5", kinds: ["attraction"], parentId: "Q4" });
    expect(shown(applyPlaceRules(file(3, [centralParent, outlier]), {}, CENTRE), "way/5")?.farKm).toBeUndefined();
  });
});
