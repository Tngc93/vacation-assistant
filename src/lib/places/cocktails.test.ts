import { describe, expect, it } from "vitest";
import { buildCategoryEntry } from "./build";
import {
  barsNear,
  cocktailBarsQuery,
  cocktailLookupQuery,
  compareCocktailBars,
  fetchCocktailBars,
  matchCocktailBar,
  mergeCocktailBars,
  parseCocktailBars,
  type CocktailBar,
} from "./cocktails";
import type { PlacesFile, StoredPlace } from "./file";
import type { Fetcher } from "./overpass";
import type { Place } from "./place";
import { refreshKinds } from "./refresh";
import type { Destination } from "@/data/destinations";

// Boadas, at the top of La Rambla.
const boadas: CocktailBar = { qid: "Q122962985", name: "Boadas Cocktail Bar", lat: 41.384658, lon: 2.170274, osmIds: [] };
const stored = (id: string, name: string, extra: Partial<StoredPlace> = {}): StoredPlace => ({ id, name, lat: 41.384658, lon: 2.170274, ...extra });
/** About `metres` north of Boadas. */
const north = (metres: number) => ({ lat: 41.384658 + metres / 111_320 });

describe("Wikidata cocktail bars", () => {
  it("asks for cocktail lounges and bars that serve cocktails, without closed ones", () => {
    const q = cocktailBarsQuery();
    expect(q).toContain("?item wdt:P31/wdt:P279* wd:Q30748895 .");
    expect(q).toContain("?item wdt:P31|wdt:P1056|wdt:P2012|wdt:P101 wd:Q134768 . ?item wdt:P31/wdt:P279* wd:Q187456 .");
    expect(q).toContain("FILTER NOT EXISTS { ?item wdt:P576 ?closed }");
    expect(q).toContain("FILTER NOT EXISTS { ?item wdt:P3999 ?closedOn }");
  });

  it("reads one bar per item with its name and OSM objects, and leaves out items without a name", () => {
    const row = (qid: string, extra: Record<string, string>) => ({
      item: { value: `http://www.wikidata.org/entity/${qid}` },
      coord: { value: "Point(-73.9744 40.7613)" },
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])),
    });
    const bars = parseCocktailBars({
      results: {
        bindings: [
          row("Q6411344", { en: "King Cole Bar", node: "2716011967" }),
          row("Q6411344", { en: "King Cole Bar", way: "12" }),
          row("Q5", { tr: "Türkçe Bar", en: "English Bar" }),
          row("Q7", {}),
        ],
      },
    });
    expect(bars).toEqual([
      { qid: "Q5", name: "Türkçe Bar", enLabel: "English Bar", lat: 40.7613, lon: -73.9744, osmIds: [] },
      { qid: "Q6411344", name: "King Cole Bar", lat: 40.7613, lon: -73.9744, osmIds: ["node/2716011967", "way/12"] },
    ]);
  });

  it("asks WDQS once, with the project's User-Agent", async () => {
    const calls: RequestInit[] = [];
    const fetcher: Fetcher = async (_url, init) => {
      calls.push(init);
      return Response.json({ results: { bindings: [] } });
    };
    await fetchCocktailBars({ fetcher });
    expect(calls).toHaveLength(1);
    expect((calls[0].headers as Record<string, string>)["User-Agent"]).toMatch(/^VacationAssistant\//);
  });

  it("asks OSM for the bars and pubs within 75 m of each bar, and for the bar's own OSM objects", () => {
    const q = cocktailLookupQuery([{ ...boadas, osmIds: ["node/7", "way/8"] }]);
    expect(q).toContain('nwr(around:75,41.384658,2.170274)["amenity"="bar"]["name"];');
    expect(q).toContain('nwr(around:75,41.384658,2.170274)["amenity"="pub"]["name"];');
    expect(q).toContain("node(id:7);");
    expect(q).toContain("way(id:8);");
    expect(q).toMatch(/out tags center;$/);
  });

  it("keeps the bars within the city's radius", () => {
    const paris: CocktailBar = { qid: "Q22317512", name: "Club RaYé", lat: 48.866, lon: 2.349, osmIds: [] };
    expect(barsNear([boadas, paris], { lat: 41.3825, lon: 2.1769 }, 6).map((b) => b.qid)).toEqual(["Q122962985"]);
  });
});

describe("matchCocktailBar", () => {
  it("matches by the OSM object's wikidata tag first, wherever it is", () => {
    const tagged = stored("node/1", "Something Else", { wikidataId: "Q122962985", ...north(400) });
    const named = stored("node/2", "Boadas");
    expect(matchCocktailBar(boadas, [named, tagged])).toBe(tagged);
  });

  it("matches by the item's OSM ID", () => {
    const bar = { ...boadas, osmIds: ["node/7"] };
    expect(matchCocktailBar(bar, [stored("node/7", "Bar 7", north(300))])?.id).toBe("node/7");
  });

  it("matches by a similar name within 75 m", () => {
    expect(matchCocktailBar(boadas, [stored("node/3", "Boadas", north(60))])?.id).toBe("node/3");
    expect(matchCocktailBar(boadas, [stored("node/3", "Café", { localName: "BOADAS", ...north(10) })])?.id).toBe("node/3");
  });

  it("does not match a similar name beyond 75 m, another name, or a bar linked to another item", () => {
    expect(matchCocktailBar(boadas, [stored("node/3", "Boadas", north(90))])).toBeUndefined();
    expect(matchCocktailBar(boadas, [stored("node/4", "Bar del Pla")])).toBeUndefined();
    expect(matchCocktailBar(boadas, [stored("node/5", "Boadas", { wikidataId: "Q9" })])).toBeUndefined();
    expect(matchCocktailBar(boadas, [stored("wikidata/Q122962985", "Boadas", { wikidataId: "Q122962985" })])).toBeUndefined();
  });
});

describe("mergeCocktailBars", () => {
  it("moves a matched pub to the cocktail bars, with the item's QID and its OSM hours", () => {
    const pub = stored("node/10", "Boadas", { openingHours: "Mo-Sa 12:00-02:00", detailed: true });
    const other = stored("node/11", "Bar del Pla");
    const out = mergeCocktailBars({ cocktail: [], pub: [pub, other] }, [boadas]);
    expect(out.pub.map((p) => p.id)).toEqual(["node/11"]);
    expect(out.cocktail).toEqual([{ ...pub, wikidataId: "Q122962985" }]);
    expect([out.matched, out.added]).toEqual([["node/10"], []]);
  });

  it("adds an unmatched bar as a Wikidata place, without hours, and is the same when run again", () => {
    const sips = stored("node/12", "Sips", north(2000));
    const once = mergeCocktailBars({ cocktail: [sips], pub: [] }, [boadas]);
    expect(once.cocktail).toEqual([
      { id: "wikidata/Q122962985", name: "Boadas Cocktail Bar", lat: 41.38466, lon: 2.17027, wikidataId: "Q122962985" },
      sips,
    ]);
    expect(once.added).toEqual(["Q122962985"]);
    const twice = mergeCocktailBars({ cocktail: once.cocktail, pub: once.pub }, [boadas]);
    expect(twice.cocktail).toEqual(once.cocktail);
    // A bar Wikidata no longer lists goes away again.
    expect(mergeCocktailBars({ cocktail: once.cocktail, pub: [] }, []).cocktail).toEqual([sips]);
  });

  it("gives a matched cocktail bar the item's QID", () => {
    const out = mergeCocktailBars({ cocktail: [stored("node/13", "Boadas")], pub: [stored("node/14", "Boadas")] }, [boadas]);
    expect(out.cocktail).toEqual([stored("node/13", "Boadas", { wikidataId: "Q122962985" })]);
    expect(out.pub).toHaveLength(1);
  });
});

describe("the data scripts", () => {
  const file = (cocktail: StoredPlace[], pub: StoredPlace[]): PlacesFile =>
    ({
      version: 5,
      cityCode: "BCN",
      categories: {
        see: { status: "ok", wikipediaCountsAvailable: true, places: [] },
        cocktail: { status: "ok", wikipediaCountsAvailable: true, places: cocktail },
        pub: { status: "ok", wikipediaCountsAvailable: true, places: pub },
      },
    }) as unknown as PlacesFile;
  const empty: Fetcher = async () => Response.json({ results: { bindings: [] }, entities: {} });

  it("data:kinds moves the pub and adds the rest", async () => {
    const madeUp: CocktailBar = { qid: "Q99", name: "Elsewhere", lat: 41.39, lon: 2.18, osmIds: [] };
    const { file: out, cocktails } = await refreshKinds(file([], [stored("node/10", "Boadas")]), {}, { fetcher: empty, cocktailBars: [boadas, madeUp] });
    const ids = (c: "cocktail" | "pub") => {
      const entry = out.categories[c];
      return entry.status === "ok" ? entry.places.map((p) => p.id) : [];
    };
    // Bars Wikidata knows first, then record detail, then the name.
    expect(ids("cocktail")).toEqual(["node/10", "wikidata/Q99"]);
    expect(ids("pub")).toEqual([]);
    expect(cocktails).toEqual({ matched: ["node/10"], added: ["Q99"] });
  });

  it("data:places leaves a moved pub out of Bar ve pub and shows it among the cocktail bars", async () => {
    const city = { cityCode: "BCN", lat: 41.3825, lon: 2.1769, radiusKm: 6 } as Destination;
    const element = { type: "node" as const, id: 10, lat: boadas.lat, lon: boadas.lon, tags: { amenity: "bar", name: "Boadas", opening_hours: "Mo-Sa 12:00-02:00" } };
    const moved: Place = { id: "node/10", category: "cocktail", name: "Boadas", lat: boadas.lat, lon: boadas.lon, openingHours: "Mo-Sa 12:00-02:00", wikidataId: boadas.qid };
    const pub = await buildCategoryEntry(city, "pub", [element], { cocktailBars: [moved] });
    const cocktail = await buildCategoryEntry(city, "cocktail", [], { cocktailBars: [moved] });
    expect(pub.places).toEqual([]);
    expect(cocktail.places).toEqual([{ id: "node/10", name: "Boadas", lat: 41.38466, lon: 2.17027, openingHours: "Mo-Sa 12:00-02:00", wikidataId: "Q122962985" }]);
  });

  it("data:places keeps a Wikidata-linked OSM cocktail bar first, ahead of more detailed ones", async () => {
    const city = { cityCode: "BCN", lat: 41.3825, lon: 2.1769, radiusKm: 6 } as Destination;
    const bar = (id: number, name: string, tags: Record<string, string> = {}) => ({
      type: "node" as const,
      id,
      lat: boadas.lat,
      lon: boadas.lon,
      tags: { amenity: "bar", cocktails: "yes", name, ...tags },
    });
    const detailed = Array.from({ length: 30 }, (_, i) => bar(100 + i, `Bar ${i}`, { website: "https://x.example", opening_hours: "Mo-Su 18:00-02:00" }));
    const linked: Place = { id: "node/10", category: "cocktail", name: "Boadas", lat: boadas.lat, lon: boadas.lon, wikidataId: boadas.qid };
    const { places } = await buildCategoryEntry(city, "cocktail", [...detailed, bar(10, "Boadas")], { cocktailBars: [linked] });
    expect(places).toHaveLength(30);
    expect(places[0]).toMatchObject({ id: "node/10", wikidataId: "Q122962985" });
  });
});

describe("compareCocktailBars", () => {
  it("puts the bars Wikidata knows before OSM's most detailed ones", () => {
    const detailed = stored("node/20", "Aaa", { website: "https://a.example", openingHours: "Mo-Su 18:00-02:00", detailed: true });
    const known = stored("wikidata/Q1", "Zzz", { wikidataId: "Q1" });
    const plain = stored("node/21", "Bbb");
    expect([plain, detailed, known].sort(compareCocktailBars).map((p) => p.id)).toEqual(["wikidata/Q1", "node/20", "node/21"]);
  });
});
