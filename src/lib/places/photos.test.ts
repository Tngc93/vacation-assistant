import { describe, expect, it } from "vitest";
import { ODBL, PLACES_FILE_VERSION, placesFileSchema, SOURCES, type PlacesFile, type StoredPlace } from "./file";
import { addPhotosAndDescriptions, cardPhotoSrcSet, commonsFileName, extrasQuery, fetchCardPhotos, parseExtras } from "./photos";
import type { Fetcher } from "./overpass";

const meta = (license: string, short: string, artist = "<a href='//commons.wikimedia.org/wiki/User:Canaan'>Canaan</a>") => ({
  License: { value: license },
  LicenseShortName: { value: short },
  LicenseUrl: { value: "http://creativecommons.org/licenses/by-sa/4.0" },
  Artist: { value: artist },
});
const info = (name: string, license: string, short: string, width = 2588) => ({
  thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/${name}/500px-${name}?utm_source=commons.wikimedia.org`,
  thumbwidth: 500,
  thumbheight: 333,
  width,
  descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}`,
  extmetadata: meta(license, short),
});

/** A fake WDQS + Commons: P18 and descriptions from the query, imageinfo from the titles asked for. */
function fakeFetcher(): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.startsWith("https://query.wikidata.org/")) {
      const query = new URLSearchParams(String(init?.body)).get("query") ?? "";
      expect(query).toContain("wdt:P18");
      return Response.json({
        results: {
          bindings: [
            {
              item: { value: "http://www.wikidata.org/entity/Q48435" },
              image: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/SF%20maig%202026.jpg" },
              tr: { value: "Barselona'da bazilika" },
              en: { value: "basilica in Barcelona" },
            },
            {
              item: { value: "http://www.wikidata.org/entity/Q2" },
              image: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/No%20derivatives.jpg" },
              en: { value: "a house" },
            },
            { item: { value: "http://www.wikidata.org/entity/Q3" } },
          ],
        },
      });
    }
    const titles = new URL(url).searchParams.get("titles")!.split("|");
    expect(titles).toEqual(["File:No derivatives.jpg", "File:SF maig 2026.jpg"]);
    return Response.json({
      query: {
        normalized: [{ from: "File:SF maig 2026.jpg", to: "File:SF maig 2026.jpg" }],
        pages: [
          { title: "File:SF maig 2026.jpg", imageinfo: [info("SF_maig_2026.jpg", "cc-by-sa-4.0", "CC BY-SA 4.0")] },
          { title: "File:No derivatives.jpg", imageinfo: [info("No_derivatives.jpg", "cc-by-nd-4.0", "CC BY-ND 4.0")] },
        ],
      },
    });
  }) as Fetcher & { calls: string[] };
  fetcher.calls = calls;
  return fetcher;
}

const place = (id: string, wikidataId?: string, extra: Partial<StoredPlace> = {}): StoredPlace => ({
  id,
  name: id,
  lat: 41.4,
  lon: 2.17,
  ...(wikidataId ? { wikidataId } : {}),
  ...extra,
});

function file(places: StoredPlace[]): PlacesFile {
  const categories = Object.fromEntries(
    ["see", "museum", "viewpoint", "restaurant", "cafe", "cocktail", "pub", "club"].map((c) => [c, { status: "ok", wikipediaCountsAvailable: true, places: c === "see" ? places : [] }]),
  );
  return placesFileSchema.parse({
    version: PLACES_FILE_VERSION,
    cityCode: "BCN",
    fetchedAt: "2026-10-22T00:00:00.000Z",
    radiusKm: 5,
    license: ODBL,
    sources: SOURCES,
    photo: null,
    categories,
  });
}

describe("card photos from Wikidata P18", () => {
  it("asks WDQS for P18 and Turkish/English descriptions, and reads Commons file names", () => {
    expect(extrasQuery(["Q1", "Q2"])).toContain("VALUES ?item { wd:Q1 wd:Q2 }");
    expect(commonsFileName("http://commons.wikimedia.org/wiki/Special:FilePath/Casa_Batll%C3%B3.jpg")).toBe("Casa Batlló.jpg");
    expect(commonsFileName("https://example.org/x.jpg")).toBeNull();
    const extras = parseExtras({
      results: { bindings: [{ item: { value: "http://www.wikidata.org/entity/Q1" }, en: { value: "a palace" } }] },
    });
    expect(extras.get("Q1")).toEqual({ description: "a palace", descriptionEn: "a palace" });
  });

  it("keeps only allowed licences (the city photo's filter): CC BY-ND is left out", async () => {
    const fetcher = fakeFetcher();
    const photos = await fetchCardPhotos(["SF maig 2026.jpg", "No derivatives.jpg"], { fetcher });
    expect([...photos.keys()]).toEqual(["SF maig 2026.jpg"]);
    expect(photos.get("SF maig 2026.jpg")).toMatchObject({
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/SF_maig_2026.jpg/500px-SF_maig_2026.jpg",
      author: "Canaan",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      fullWidth: 2588,
    });
  });

  it("adds a photo and a Turkish description (else English) to places with an item, and nothing to others", async () => {
    const fetcher = fakeFetcher();
    const out = await addPhotosAndDescriptions(file([place("node/1", "Q48435"), place("node/2", "Q2"), place("node/3", "Q3"), place("node/4")]), {
      fetcher,
    });
    const [sagrada, house, bare, osmOnly] = (out.categories.see as { places: StoredPlace[] }).places;
    expect(sagrada.photo?.license).toBe("CC BY-SA 4.0");
    expect(sagrada.description).toBe("Barselona'da bazilika");
    expect(house.photo).toBeUndefined(); // CC BY-ND: not allowed
    expect(house.description).toBe("a house");
    expect(bare).toEqual(place("node/3", "Q3"));
    expect(osmOnly).toEqual(place("node/4"));
    expect(placesFileSchema.safeParse(out).success).toBe(true);
  });

  it("builds srcset from Commons' standard widths, never wider than the original", () => {
    const src = "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/A.jpg/500px-A.jpg";
    expect(cardPhotoSrcSet({ src, width: 500, fullWidth: 2588 })).toBe(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/A.jpg/330px-A.jpg 330w, " +
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/A.jpg/500px-A.jpg 500w",
    );
    expect(cardPhotoSrcSet({ src, width: 400, fullWidth: 400 })).not.toContain("500w");
    expect(cardPhotoSrcSet({ src: "https://upload.wikimedia.org/wikipedia/commons/7/78/A.jpg", width: 300 })).toBe("");
  });
});
