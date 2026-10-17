import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_IDS, classify, DEFAULT_CATEGORIES, isCocktailBar } from "./categories";

describe("category mapping", () => {
  it.each([
    [{ tourism: "attraction" }, ["see"]],
    [{ historic: "monument" }, ["see"]],
    [{ historic: "castle" }, ["see"]],
    [{ historic: "ruins" }, ["see"]],
    [{ historic: "archaeological_site" }, ["see"]],
    [{ historic: "memorial" }, []],
    [{ tourism: "museum" }, ["museum"]],
    [{ tourism: "gallery" }, ["museum"]],
    [{ tourism: "viewpoint" }, ["viewpoint"]],
    [{ amenity: "restaurant" }, ["restaurant"]],
    [{ amenity: "cafe" }, ["cafe"]],
    [{ amenity: "nightclub" }, ["club"]],
    [{ amenity: "pub" }, ["pub"]],
    [{ amenity: "bar" }, ["pub"]],
    [{ amenity: "fast_food" }, []],
    [{ tourism: "attraction", historic: "castle", amenity: "restaurant" }, ["see", "restaurant"]],
  ])("%j → %j", (tags, expected) => {
    expect(classify(tags)).toEqual(expected);
  });

  describe("cocktail bars", () => {
    it.each([{ cocktails: "yes" }, { bar: "cocktail" }, { "drink:cocktail": "yes" }])(
      "a bar with %j is a cocktail bar and not a bar/pub",
      (extra) => {
        const tags = { amenity: "bar", ...extra };
        expect(isCocktailBar(tags)).toBe(true);
        expect(classify(tags)).toEqual(["cocktail"]);
      },
    );

    it.each([
      { amenity: "bar", cocktails: "no" },
      { amenity: "pub", cocktails: "yes" },
      { amenity: "bar", "drink:cocktail": "served" },
    ])("%j is not a cocktail bar", (tags) => {
      expect(isCocktailBar(tags)).toBe(false);
      expect(classify(tags)).toEqual(["pub"]);
    });
  });

  it("defines every category once, with Overpass filters and a ranking", () => {
    expect(Object.keys(CATEGORIES)).toEqual([...CATEGORY_IDS]);
    for (const id of CATEGORY_IDS) {
      expect(CATEGORIES[id].filters.length).toBeGreaterThan(0);
      // Exact key=value filters only: regex filters cannot use Overpass's index.
      for (const filter of CATEGORIES[id].filters) expect(filter).toMatch(/^(\["[^"]+"="[^"]+"\])+$/);
    }
    expect(DEFAULT_CATEGORIES).toEqual(["see", "museum", "restaurant"]);
  });

  it("ranks sights by Wikipedia and food and drink by record detail", () => {
    expect(["see", "museum", "viewpoint"].every((id) => CATEGORIES[id as "see"].ranking === "wikipedia")).toBe(true);
    expect(
      ["restaurant", "cafe", "cocktail", "pub", "club"].every((id) => CATEGORIES[id as "pub"].ranking === "detail"),
    ).toBe(true);
  });
});
