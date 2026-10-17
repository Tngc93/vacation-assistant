import { describe, expect, it } from "vitest";
import { parseCategories, serializeCategories, toggleCategory } from "./cats";

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
