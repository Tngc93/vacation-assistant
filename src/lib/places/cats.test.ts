import { describe, expect, it } from "vitest";
import { parseCategories, parseShowEvents, serializeCategories, serializeCats, toggleCategory } from "./cats";

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

describe("the events token in ?cats=", () => {
  it("shows events by default and when listed, and leaves the categories alone", () => {
    expect(parseShowEvents(undefined)).toBe(true);
    expect(parseShowEvents("see,event")).toBe(true);
    expect(parseShowEvents(["Event"])).toBe(true);
    expect(parseShowEvents("see,museum")).toBe(false);
    expect(parseShowEvents("")).toBe(false);
    expect(parseCategories("event,see")).toEqual(["see"]);
  });

  it("writes the token after the categories", () => {
    expect(serializeCats(["museum", "see"], true)).toBe("see,museum,event");
    expect(serializeCats(["see"], false)).toBe("see");
    expect(serializeCats([], true)).toBe("event");
    expect(serializeCats([], false)).toBe("");
  });
});
