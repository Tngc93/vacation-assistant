import { describe, expect, it } from "vitest";
import { eveningCategoriesFor } from "./config";
import { osmIdFromShort, parseSkip, serializeSkip, shortId } from "./ids";
import { openCheck, openDuring, openVerdict } from "./openCheck";
import { hhmm, roundUp, toMinutes, weekdayOf } from "./time";
import { travelBetween } from "./travel";

describe("itinerary helpers", () => {
  it("shortens OSM ids for the URL and reads them back", () => {
    expect(shortId("node/123")).toBe("n123");
    expect(shortId("way/45")).toBe("w45");
    expect(shortId("relation/6")).toBe("r6");
    expect(osmIdFromShort("w45")).toBe("way/45");
    expect(osmIdFromShort("x1")).toBeNull();
    expect(parseSkip("w45,n123,bad,n123")).toEqual(["n123", "w45"]);
    expect(parseSkip(undefined)).toEqual([]);
    expect(serializeSkip(["w45", "n123", "w45"])).toBe("n123,w45");
    // Must-see places from Wikidata that OSM lacks.
    expect(shortId("wikidata/Q207870")).toBe("q207870");
    expect(osmIdFromShort("q207870")).toBe("wikidata/Q207870");
    expect(parseSkip("q207870,n1")).toEqual(["n1", "q207870"]);
  });

  it("knows weekdays and minutes", () => {
    expect(weekdayOf("2026-11-16")).toBe(0); // Monday
    expect(weekdayOf("2026-11-15")).toBe(6); // Sunday
    expect(toMinutes("09:05")).toBe(545);
    expect(hhmm(545)).toBe("09:05");
    expect(hhmm(1440 + 30)).toBe("00:30");
    expect(roundUp(541)).toBe(545);
  });

  it("checks that a place is open for the whole visit, including past midnight", () => {
    expect(openVerdict("Mo-Fr 10:00-18:00", 0, 600, 720)).toBe("open");
    expect(openVerdict("Mo-Fr 10:00-18:00", 0, 540, 660)).toBe("closed"); // opens at 10:00
    expect(openVerdict("Mo-Fr 10:00-18:00", 0, 1020, 1140)).toBe("closed"); // closes mid-visit
    expect(openVerdict("Mo-Fr 10:00-18:00", 5, 600, 720)).toBe("closed"); // Saturday
    expect(openVerdict("Mo-Su 18:00-02:00", 1, 30, 90)).toBe("open"); // Tue 00:30 from Monday's evening
    expect(openVerdict(undefined, 0, 600, 720)).toBe("unknown");
    expect(openVerdict("Mo-Fr 09:00-18:00; PH off", 0, 600, 720)).toBe("unknown");
    expect(openDuring(Array.from({ length: 7 }, () => [{ start: 0, end: 1440 }]), 3, 1380, 1500)).toBe(true); // 24/7
    expect(openCheck("Mo-Fr 10:00-18:00", 0, 900, 1020)).toEqual({ verdict: "open", closesAt: 1080 });
    expect(openCheck(undefined, 0, 900, 1020)).toEqual({ verdict: "unknown", closesAt: null });
  });

  it("estimates walks as straight line × 1.3 at 4.5 km/h, rounded up to 5 minutes", () => {
    // ~1 km north: 1 × 1.3 / 4.5 h = 17.3 min → 20.
    const walk = travelBetween({ lat: 41.39, lon: 2.17 }, { lat: 41.399, lon: 2.17 });
    expect(walk.km).toBeCloseTo(1.0, 1);
    expect(walk).toMatchObject({ walkMin: 20, transit: false, scheduledMin: 20 });
    const far = travelBetween({ lat: 41.39, lon: 2.17 }, { lat: 41.43, lon: 2.17 });
    expect(far.transit).toBe(true);
    expect(far.walkMin).toBeGreaterThan(60);
    expect(far.scheduledMin).toBe(30);
    expect(travelBetween({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }).walkMin).toBe(5);
  });

  it("uses the chosen evening chips, or restaurants when none is chosen", () => {
    expect(eveningCategoriesFor(["see", "cocktail", "club"])).toEqual(["cocktail", "club"]);
    expect(eveningCategoriesFor(["see", "museum"])).toEqual(["restaurant"]);
  });
});
