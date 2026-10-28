import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PlacesFile, StoredPlace } from "./file";
import { isLatin, osmLatinNames, readableName } from "./names";
import type { Fetcher } from "./overpass";
import { toPlace } from "./place";
import { refreshKinds } from "./refresh";
import { applyPlaceRules } from "./rules";

describe("isLatin", () => {
  it("is true for Latin letters with accents, digits and punctuation, false for any letter in another script", () => {
    for (const name of ["Park Güell", "Sensō-ji", "Moskova Kremlini", "Musée d'Orsay", "10 Downing Street", "Çar Çanı", "123"]) {
      expect(isLatin(name), name).toBe(true);
    }
    for (const name of ["東京タワー", "Московский Кремль", "Παρθενώνας", "دار الباشا", "경복궁", "Храм Сенсодзи 金龍山 浅草寺", "Café 東京"]) {
      expect(isLatin(name), name).toBe(false);
    }
  });
});

describe("readableName: a name in another script is never primary when a Latin one exists", () => {
  const tower = { name: "東京タワー" };

  it("takes the Wikidata Turkish label first, then English, then OSM name:en, name:latin, int_name", () => {
    const all = { labels: { tr: "Tokyo Kulesi", en: "Tokyo Tower" }, osmNames: { en: "Tokyo Tower (OSM)", latin: "Tōkyō Tawā", int: "Tokyo Tower int" } };
    expect(readableName({ ...tower, ...all })).toEqual({ name: "Tokyo Kulesi", localName: "東京タワー" });
    expect(readableName({ ...tower, ...all, labels: { en: "Tokyo Tower" } }).name).toBe("Tokyo Tower");
    expect(readableName({ ...tower, osmNames: all.osmNames }).name).toBe("Tokyo Tower (OSM)");
    expect(readableName({ ...tower, osmNames: { latin: "Tōkyō Tawā", int: "x" } }).name).toBe("Tōkyō Tawā");
    expect(readableName({ ...tower, osmNames: { int: "Tokyo Tower int" } }).name).toBe("Tokyo Tower int");
  });

  it("skips an alternative that is not Latin either", () => {
    expect(readableName({ name: "Храм Сенсодзи 金龍山 浅草寺", labels: { tr: "浅草寺", en: "Sensō-ji" } })).toEqual({
      name: "Sensō-ji",
      localName: "Храм Сенсодзи 金龍山 浅草寺",
    });
  });

  it("keeps the local name when no Latin alternative exists", () => {
    expect(readableName({ name: "دار الباشا" })).toEqual({ name: "دار الباشا" });
    expect(readableName({ name: "دار الباشا", labels: { tr: "دار الباشا" }, osmNames: {} })).toEqual({ name: "دار الباشا" });
  });

  it("leaves a Latin name as it is, even with an English label (only names in another script are replaced)", () => {
    expect(readableName({ name: "Museu Nacional d'Art de Catalunya", labels: { en: "National Art Museum of Catalonia" } })).toEqual({
      name: "Museu Nacional d'Art de Catalunya",
    });
    expect(readableName({ name: "Güell Parkı", localName: "Park Güell" })).toEqual({ name: "Güell Parkı", localName: "Park Güell" });
  });
});

describe("OSM Latin names on fetch", () => {
  const element = (tags: Record<string, string>) => ({ type: "node" as const, id: 1, lat: 35.6586, lon: 139.7454, tags: { tourism: "attraction", ...tags } });

  it("reads name:en, name:latin (else a name:xx-Latn) and int_name", () => {
    expect(osmLatinNames({ name: "x", "name:en": "Tokyo Tower", "name:ja-Latn": "Tōkyō Tawā", int_name: "Tokyo Tower" })).toEqual({
      en: "Tokyo Tower",
      latin: "Tōkyō Tawā",
      int: "Tokyo Tower",
    });
    expect(osmLatinNames({ "name:latin": "A", "name:ja-Latn": "B" })).toEqual({ latin: "A" });
    expect(osmLatinNames({ name: "x" })).toBeUndefined();
  });

  it("stores them only when the name is in another script and OSM has no Turkish name", () => {
    expect(toPlace(element({ name: "東京タワー", "name:en": "Tokyo Tower" }), "see")).toMatchObject({ name: "東京タワー", osmNames: { en: "Tokyo Tower" } });
    expect(toPlace(element({ name: "Torre", "name:en": "Tower" }), "see")).not.toHaveProperty("osmNames");
    expect(toPlace(element({ name: "東京タワー", "name:tr": "Tokyo Kulesi", "name:en": "Tokyo Tower" }), "see")).not.toHaveProperty("osmNames");
  });
});

describe("Wikidata labels for names in another script (refreshKinds)", () => {
  it("stores the item's Turkish and English labels for those places only, in every category", async () => {
    const asked: string[] = [];
    const fetcher: Fetcher = async (url, init) => {
      if (url.startsWith("https://www.wikidata.org/w/api.php")) {
        const ids = new URL(url).searchParams.get("ids")?.split("|") ?? [];
        asked.push(...ids);
        const labels: Record<string, Record<string, { value: string }>> = {
          Q183536: { tr: { value: "Tokyo Kulesi" }, en: { value: "Tokyo Tower" } },
          Q2: { en: { value: "Some Café" } },
        };
        return Response.json({ entities: Object.fromEntries(ids.map((id) => [id, { labels: labels[id] ?? {}, sitelinks: {} }])) });
      }
      void init;
      return Response.json({ results: { bindings: [] } });
    };
    const at = (id: string, name: string, qid: string): StoredPlace => ({ id, name, lat: 35.6586, lon: 139.7454, wikidataId: qid, labels: { tr: "stale" } });
    const input = {
      version: 5,
      cityCode: "TYO",
      categories: {
        see: { status: "ok", wikipediaCountsAvailable: true, places: [at("way/1", "東京タワー", "Q183536"), at("way/3", "Senso-ji", "Q3")] },
        cafe: { status: "ok", wikipediaCountsAvailable: false, places: [at("node/2", "カフェ", "Q2")] },
      },
    } as unknown as PlacesFile;
    const { file } = await refreshKinds(input, {}, { fetcher, kinds: new Map() });
    const all = Object.values(file.categories).flatMap((c) => (c.status === "ok" ? c.places : []));
    expect(all.find((p) => p.id === "way/1")?.labels).toEqual({ tr: "Tokyo Kulesi", en: "Tokyo Tower" });
    expect(all.find((p) => p.id === "node/2")?.labels).toEqual({ en: "Some Café" });
    // A Latin name keeps no labels, and is not asked for.
    expect(all.find((p) => p.id === "way/3")).not.toHaveProperty("labels");
    expect(asked).not.toContain("Q3");
  });
});

describe("applyPlaceRules shows the readable name", () => {
  const file = (see: StoredPlace[], cafe: StoredPlace[] = []) =>
    ({
      version: 5,
      cityCode: "MOW",
      radiusKm: 4,
      categories: {
        see: { status: "ok", wikipediaCountsAvailable: true, places: see },
        cafe: { status: "ok", wikipediaCountsAvailable: false, places: cafe },
      },
    }) as unknown as PlacesFile;
  const kremlin: StoredPlace = {
    id: "way/1",
    name: "Московский Кремль",
    lat: 55.752,
    lon: 37.6175,
    wikidataId: "Q133274",
    wikipediaCount: 120,
    kinds: ["castle"],
    labels: { tr: "Moskova Kremlini", en: "Moscow Kremlin" },
  };
  const bell: StoredPlace = {
    id: "node/2",
    name: "Царь-колокол",
    lat: 55.7514,
    lon: 37.6185,
    wikidataId: "Q147875",
    wikipediaCount: 60,
    kinds: ["attraction"],
    parentId: "Q133274",
    parentName: "Московский Кремль",
  };
  const cafe: StoredPlace = { id: "node/3", name: "Кофемания", lat: 55.75, lon: 37.62, osmNames: { en: "Coffeemania" } };

  it("puts the Latin name first and the local one second, and drops the raw name fields", () => {
    const shown = Object.values(applyPlaceRules(file([kremlin, bell], [cafe]), {}).categories).flatMap((c) => (c.status === "ok" ? c.places : []));
    const byId = new Map(shown.map((p) => [p.id, p]));
    expect(byId.get("way/1")).toMatchObject({ name: "Moskova Kremlini", localName: "Московский Кремль" });
    expect(byId.get("way/1")).not.toHaveProperty("labels");
    expect(byId.get("node/3")).toMatchObject({ name: "Coffeemania", localName: "Кофемания" });
    expect(byId.get("node/3")).not.toHaveProperty("osmNames");
    // No Latin alternative: romanized by Russia's system (ICAO), and the parent's caption uses the parent's shown name.
    expect(byId.get("node/2")).toMatchObject({ name: "Tsar-kolokol", localName: "Царь-колокол", parentName: "Moskova Kremlini" });
  });

  it("never shows a wrong link's labels", () => {
    const wrong: StoredPlace = { ...kremlin, kinds: ["farFromItem"] };
    const shown = applyPlaceRules(file([wrong]), {}).categories.see;
    expect(shown.status === "ok" && shown.places.find((p) => p.id === "way/1")).toMatchObject({
      name: "Moskovskii Kreml",
      localName: "Московский Кремль",
    });
  });

  it("keeps the local name primary in a city whose language is not romanized, or without a country", () => {
    const tokyo = { ...file([{ id: "node/9", name: "東京タワー", lat: 35.6586, lon: 139.7454 }]), cityCode: "TYO" };
    const see = applyPlaceRules(tokyo, {}).categories.see;
    expect(see.status === "ok" && see.places[0]).toMatchObject({ name: "東京タワー" });
    expect(see.status === "ok" && see.places[0]).not.toHaveProperty("localName");
    const unknown = applyPlaceRules({ ...file([bell]), cityCode: "XXX" }, {}).categories.see;
    expect(unknown.status === "ok" && unknown.places[0].name).toBe("Царь-колокол");
  });
});

describe("rename override: the Moscow Kremlin", () => {
  const stored = (): PlacesFile => JSON.parse(readFileSync(path.join(process.cwd(), "src/data/places/MOW.json"), "utf8")) as PlacesFile;

  it("is 'Moskova Kremlini' (Wikidata's Turkish label is 'Kremlini'), with the stored name under it", () => {
    const kremlin = stored().categories.see;
    const raw = kremlin.status === "ok" ? kremlin.places.find((p) => p.wikidataId === "Q133274") : undefined;
    // The data still has the wrong label: when Wikidata is fixed, this fails and the override can go.
    expect(raw?.labels?.tr).toBe("Kremlini");
    const see = applyPlaceRules(stored()).categories.see;
    const shown = see.status === "ok" ? see.places : [];
    expect(shown.find((p) => p.wikidataId === "Q133274")).toMatchObject({ name: "Moskova Kremlini", localName: "Московский Кремль" });
  });

  it("names the parent in the caption of every place inside it", () => {
    const all = Object.values(applyPlaceRules(stored()).categories).flatMap((c) => (c.status === "ok" ? c.places : []));
    const inside = all.filter((p) => p.parentId === "Q133274");
    expect(inside.length).toBeGreaterThan(2);
    for (const p of inside) expect(p.parentName, p.name).toBe("Moskova Kremlini");
  });
});
