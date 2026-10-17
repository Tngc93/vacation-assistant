import { describe, expect, it } from "vitest";
import { CUISINE_TR, describeCuisine } from "./cuisine";

describe("describeCuisine", () => {
  it("translates common OSM values, in the stored form or the raw OSM form", () => {
    expect(describeCuisine("indian")).toBe("Hint");
    expect(describeCuisine("italian")).toBe("İtalyan");
    expect(describeCuisine("pizza")).toBe("Pizza");
    expect(describeCuisine("coffee shop")).toBe("Kahve");
    expect(describeCuisine("coffee_shop")).toBe("Kahve");
    expect(describeCuisine("steak house")).toBe("Steakhouse");
  });

  it("keeps several values in order and shows a repeated name once", () => {
    expect(describeCuisine("italian, pizza")).toBe("İtalyan, Pizza");
    expect(describeCuisine("coffee_shop;sandwich")).toBe("Kahve, Sandviç");
    expect(describeCuisine("coffee shop, coffee")).toBe("Kahve");
  });

  it("never hides an unknown value: it is shown with a capital first letter", () => {
    expect(describeCuisine("catalan")).toBe("Catalan");
    expect(describeCuisine("fish and chips")).toBe("Fish and chips");
    expect(describeCuisine("indian, nepalese")).toBe("Hint, Nepalese");
    // Plain capitalisation, not Turkish: an English word must not get a dotted İ.
    expect(describeCuisine("iberian")).toBe("Iberian");
  });

  it("covers 50 values with readable Turkish names", () => {
    expect(Object.keys(CUISINE_TR)).toHaveLength(50);
    for (const [key, name] of Object.entries(CUISINE_TR)) {
      expect(key).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(name).toMatch(/^\p{Lu}/u);
    }
  });
});
