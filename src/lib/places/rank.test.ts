import { describe, expect, it } from "vitest";
import type { Place } from "./place";
import { detailScore, MAX_PLACES_PER_CATEGORY, rankPlaces } from "./rank";

const place = (id: string, extra: Partial<Place> = {}): Place => ({
  id,
  category: "museum",
  name: id,
  lat: 0,
  lon: 0,
  ...extra,
});

describe("rankPlaces", () => {
  it("orders sights by Wikipedia language count, unknowns after", () => {
    const counts = new Map([
      ["Q1", 112],
      ["Q2", 40],
    ]);
    const ranked = rankPlaces(
      [place("Ada", {}), place("Small", { wikidataId: "Q2" }), place("Big", { wikidataId: "Q1" })],
      "museum",
      counts,
    );
    expect(ranked.map((p) => [p.name, p.wikipediaCount])).toEqual([
      ["Big", 112],
      ["Small", 40],
      ["Ada", undefined],
    ]);
  });

  it("orders food and drink by record detail and labels detailed records", () => {
    const ranked = rankPlaces(
      [
        place("Bare", { category: "restaurant" }),
        place("Full", { category: "restaurant", website: "https://a", openingHours: "Mo 9-5", cuisine: "tapas" }),
        place("Two", { category: "restaurant", website: "https://b", cuisine: "pizza" }),
        place("One", { category: "restaurant", openingHours: "Mo 9-5" }),
      ],
      "restaurant",
    );
    expect(ranked.map((p) => [p.name, p.detailed ?? false])).toEqual([
      ["Full", true],
      ["Two", true],
      ["One", false],
      ["Bare", false],
    ]);
    expect(ranked.every((p) => p.wikipediaCount === undefined)).toBe(true);
  });

  it("does not claim Wikipedia counts for food or detail labels for sights", () => {
    const counts = new Map([["Q1", 50]]);
    expect(rankPlaces([place("R", { category: "restaurant", wikidataId: "Q1" })], "restaurant", counts)[0]).not.toHaveProperty(
      "wikipediaCount",
    );
    const sight = place("S", { website: "https://a", openingHours: "x", cuisine: "y" });
    expect(rankPlaces([sight], "museum")[0]).not.toHaveProperty("detailed");
  });

  it("breaks ties by Turkish alphabetical order, removes duplicates and keeps at most 30", () => {
    const many = Array.from({ length: 45 }, (_, i) => place(`P${String(i).padStart(2, "0")}`));
    expect(rankPlaces([...many, many[0]], "museum")).toHaveLength(MAX_PLACES_PER_CATEGORY);
    expect(rankPlaces([place("Zeytin"), place("Çınar"), place("Cam")], "museum").map((p) => p.name)).toEqual([
      "Cam",
      "Çınar",
      "Zeytin",
    ]);
  });

  it("keeps one place mapped as several OSM objects once, at its best rank, without using up a slot", () => {
    const counts = new Map([["Q1", 80]]);
    const twins = [
      place("way/2", { name: "La Rambla", lat: 41.3841, lon: 2.1706 }),
      place("way/1", { name: "La Rambla", lat: 41.3809, lon: 2.1735, wikidataId: "Q1" }),
    ];
    const many = Array.from({ length: 40 }, (_, i) => place(`P${String(i).padStart(2, "0")}`));
    const ranked = rankPlaces([...twins, ...many], "museum", counts);
    expect(ranked).toHaveLength(MAX_PLACES_PER_CATEGORY);
    expect(ranked[0]).toMatchObject({ id: "way/1", wikipediaCount: 80 });
    expect(ranked.filter((p) => p.name === "La Rambla")).toHaveLength(1);
    expect(ranked.at(-1)?.name).toBe("P28");
  });

  it("keeps chain branches with the same name apart in food and drink", () => {
    const branches = [
      place("node/1", { category: "cafe", name: "Starbucks", lat: 41.3851, lon: 2.1734 }),
      place("node/2", { category: "cafe", name: "Starbucks", lat: 41.3871, lon: 2.1701 }),
    ];
    expect(rankPlaces(branches, "cafe")).toHaveLength(2);
  });

  it("scores detail from website, opening hours and cuisine", () => {
    expect(detailScore(place("x", { website: "w", openingHours: "o", cuisine: "c" }))).toBe(3);
    expect(detailScore(place("x"))).toBe(0);
  });
});
