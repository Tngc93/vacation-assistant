import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/overpass-museums.json";
import type { OverpassElement } from "./overpass";
import { toPlace } from "./place";

const elements = fixture.elements as unknown as OverpassElement[];

describe("toPlace", () => {
  it("prefers the Turkish name and keeps the local one", () => {
    expect(toPlace(elements[0], "museum")).toEqual({
      id: "node/101",
      category: "museum",
      name: "Picasso Müzesi",
      localName: "Museu Picasso",
      lat: 41.3851,
      lon: 2.1734,
      address: "Carrer de Montcada 15-23",
      website: "https://museupicasso.bcn.cat/",
      wikidataId: "Q1046553",
    });
  });

  it("uses the centre of ways and the neighbourhood when there is no street", () => {
    expect(toPlace(elements[1], "museum")).toMatchObject({ id: "way/202", lat: 41.3687, lon: 2.1534, address: "Montjuïc" });
  });

  it("skips unnamed elements and elements of another category", () => {
    expect(toPlace(elements[3], "museum")).toBeNull();
    expect(toPlace(elements[4], "museum")).toBeNull();
  });

  it("never lists a cocktail bar under bar and pub", () => {
    const bar: OverpassElement = { type: "node", id: 9, lat: 1, lon: 1, tags: { amenity: "bar", name: "Paradiso", cocktails: "yes" } };
    expect(toPlace(bar, "pub")).toBeNull();
    expect(toPlace(bar, "cocktail")).toMatchObject({ name: "Paradiso", category: "cocktail" });
  });

  it("only keeps http(s) websites", () => {
    const tags = { tourism: "museum", name: "X" };
    const withSite = (website: string) =>
      toPlace({ type: "node", id: 1, lat: 1, lon: 1, tags: { ...tags, website } }, "museum")?.website;
    expect(withSite("javascript:alert(1)")).toBeUndefined();
    expect(withSite("http://example.org/a")).toBe("http://example.org/a");
    expect(withSite("example.org")).toBe("https://example.org/");
  });
});
