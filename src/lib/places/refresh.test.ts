import { describe, expect, it } from "vitest";
import type { PlacesFile, StoredPlace } from "./file";
import type { Fetcher } from "./overpass";
import { refreshKinds } from "./refresh";

const place = (id: string, qid: string, extra: Partial<StoredPlace> = {}): StoredPlace => ({ id, name: id, lat: 40.7114, lon: -74.0127, wikidataId: qid, ...extra });
const file = (see: StoredPlace[], museum: StoredPlace[]): PlacesFile =>
  ({
    version: 3,
    cityCode: "NYC",
    categories: {
      see: { status: "ok", wikipediaCountsAvailable: true, places: see },
      museum: { status: "ok", wikipediaCountsAvailable: true, places: museum },
      restaurant: { status: "ok", wikipediaCountsAvailable: true, places: [] },
    },
  }) as unknown as PlacesFile;

// WDQS answers: kinds, then coordinates; wbgetentities answers the relink's Wikipedia count.
const fetcher: Fetcher = async (url, init) => {
  if (url.startsWith("https://www.wikidata.org/w/api.php")) {
    return Response.json({ entities: { Q1136137: { sitelinks: Object.fromEntries(Array.from({ length: 34 }, (_, i) => [`${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}wiki`, {}])) } } });
  }
  const query = new URLSearchParams(String(init.body)).get("query") ?? "";
  const row = (item: string, key: string, value: string) => ({ item: { value: `http://www.wikidata.org/entity/${item}` }, [key]: { value } });
  if (query.includes("wdt:P625 ?coord")) {
    return Response.json({ results: { bindings: [row("Q1136137", "coord", "Point(-74.0136 40.7114)"), row("Q9", "coord", "Point(51.5 25.3)")] } });
  }
  return Response.json({ results: { bindings: [row("Q1136137", "class", "http://www.wikidata.org/entity/Q33506")] } });
};

describe("refreshKinds", () => {
  it("relinks an OSM object, drops the Wikidata copy of the right item, and stores kinds and link tags", async () => {
    const memorial = place("way/278033604", "Q10806", { wikipediaCount: 151 });
    const copy = place("wikidata/Q1136137", "Q1136137", { wikipediaCount: 34 });
    const far = place("node/2", "Q9", { wikipediaCount: 3 });
    const nowhere = place("node/3", "Q8", { wikipediaCount: 2 });
    const relink = [{ osmId: "way/278033604", from: "Q10806", qid: "Q1136137", name: "9/11", reason: "test" }];
    const { file: out, relinked, missing } = await refreshKinds(file([copy, far, nowhere], [memorial]), { relink }, { fetcher });
    expect([relinked, missing]).toEqual([["way/278033604"], []]);
    const museum = out.categories.museum.status === "ok" ? out.categories.museum.places : [];
    const see = out.categories.see.status === "ok" ? out.categories.see.places : [];
    expect(museum[0]).toMatchObject({ wikidataId: "Q1136137", wikipediaCount: 34, kinds: ["museum"] });
    expect(see.map((p) => [p.id, p.kinds])).toEqual([
      ["node/2", ["farFromItem"]],
      ["node/3", ["noCoordinate"]],
    ]);
  });

  it("reports a relink whose OSM object is not in the file", async () => {
    const relink = [{ osmId: "way/1", from: "Q1", qid: "Q1136137", name: "x", reason: "test" }];
    const { missing } = await refreshKinds(file([], []), { relink }, { fetcher });
    expect(missing).toEqual(["way/1"]);
  });
});
