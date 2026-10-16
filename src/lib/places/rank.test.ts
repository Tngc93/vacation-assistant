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

  it("scores detail from website, opening hours and cuisine", () => {
    expect(detailScore(place("x", { website: "w", openingHours: "o", cuisine: "c" }))).toBe(3);
    expect(detailScore(place("x"))).toBe(0);
  });
});
