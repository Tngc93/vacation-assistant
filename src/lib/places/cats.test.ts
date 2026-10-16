import { describe, expect, it } from "vitest";
import { parseCategories, serializeCategories, toggleCategory } from "./cats";
import { placesCacheKey } from "./keys";

describe("cats URL parameter", () => {
  it("defaults to sights, museums and restaurants when missing", () => {
    expect(parseCategories(undefined)).toEqual(["see", "museum", "restaurant"]);
    expect(parseCategories(null)).toEqual(["see", "museum", "restaurant"]);
  });

  it("keeps known ids in canonical order, without duplicates", () => {
    expect(parseCategories("cocktail,see,museum,see,Club")).toEqual(["see", "museum", "cocktail", "club"]);
    expect(parseCategories(["pub", "cafe"])).toEqual(["pub"]);
  });

  it("drops unknown ids and respects an explicit empty selection", () => {
    expect(parseCategories("see,casino,<script>")).toEqual(["see"]);
    expect(parseCategories("")).toEqual([]);
  });

  it("round-trips and toggles", () => {
    expect(serializeCategories(["cocktail", "see", "museum"])).toBe("see,museum,cocktail");
    expect(parseCategories(serializeCategories(["club", "cafe"]))).toEqual(["cafe", "club"]);
    expect(toggleCategory(["see", "museum"], "museum")).toEqual(["see"]);
    expect(toggleCategory(["see"], "viewpoint")).toEqual(["see", "viewpoint"]);
  });
});

describe("places cache key", () => {
  it("is one key per city and category, case-insensitive on the city", () => {
    expect(placesCacheKey("bcn", "museum")).toBe("places:BCN:museum");
    expect(placesCacheKey("BCN", "museum")).toBe(placesCacheKey("bcn", "museum"));
    expect(placesCacheKey("BCN", "cafe")).not.toBe(placesCacheKey("BCN", "museum"));
    expect(placesCacheKey("SJJ", "museum")).not.toBe(placesCacheKey("BCN", "museum"));
  });

  it("refuses anything else", () => {
    expect(() => placesCacheKey("BCN1", "museum")).toThrow();
    expect(() => placesCacheKey("BCN", "casino" as "museum")).toThrow();
  });
});
