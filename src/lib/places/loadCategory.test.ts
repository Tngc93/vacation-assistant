import { describe, expect, it } from "vitest";
import museums from "./__fixtures__/overpass-museums.json";
import sitelinks from "./__fixtures__/wikidata-sitelinks.json";
import { loadCategory } from "./loadCategory";
import type { Fetcher } from "./overpass";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fetcher(wikidata: "ok" | "down"): Fetcher {
  return async (url) => {
    if (url.includes("overpass")) return reply(museums);
    if (url.includes("wikidata")) return wikidata === "ok" ? reply(sitelinks) : reply({}, 503);
    throw new Error(`unexpected ${url}`);
  };
}

describe("loadCategory", () => {
  it("turns Overpass results into ranked places with Wikipedia counts", async () => {
    const result = await loadCategory("BCN", "museum", { fetcher: fetcher("ok") });
    expect(result.wikipediaCountsAvailable).toBe(true);
    expect(result.places.map((p) => [p.name, p.wikipediaCount])).toEqual([
      ["Museu Nacional d'Art de Catalunya", 6],
      ["Picasso Müzesi", 4],
      ["Galeria Petita", undefined],
    ]);
  });

  it("still lists places when Wikidata is down, and says so", async () => {
    const result = await loadCategory("BCN", "museum", { fetcher: fetcher("down") });
    expect(result.wikipediaCountsAvailable).toBe(false);
    expect(result.places).toHaveLength(3);
    expect(result.places.every((p) => p.wikipediaCount === undefined)).toBe(true);
  });

  it("throws (and so is never cached) when Overpass fails everywhere", async () => {
    const down: Fetcher = async () => reply({}, 504);
    await expect(loadCategory("BCN", "museum", { fetcher: down })).rejects.toThrow(/Overpass/);
  });

  it("refuses unknown cities", async () => {
    await expect(loadCategory("XXX", "museum", { fetcher: fetcher("ok") })).rejects.toThrow(/Unknown city/);
  });
});
