import { describe, expect, it } from "vitest";
import type { PlacesFile, StoredPlace } from "./file";
import type { KindTag } from "./kinds";
import { applyPlaceRules, hasWrongLink, isResidence, isSight, isWalkThrough } from "./rules";

const sight = (qid: string, kinds: KindTag[] = [], wikidataOnly = true): StoredPlace => ({
  id: wikidataOnly ? `wikidata/${qid}` : `way/${qid.slice(1)}`,
  name: qid,
  lat: 48.86,
  lon: 2.35,
  wikidataId: qid,
  ...(kinds.length ? { kinds } : {}),
});

describe("sight rules", () => {
  it("keeps listed concert halls and theatres (Royal Albert Hall, Musikverein), leaves unlisted ones out", () => {
    expect(isSight(sight("Q193639", ["concertHall", "heritage"]), "see")).toBe(true);
    expect(isSight(sight("Q686720", ["concertHall", "heritage", "musicVenue"]), "see")).toBe(true);
    expect(isSight(sight("Q2", ["theatre", "heritage"]), "see")).toBe(true);
    expect(isSight(sight("Q673223", ["concertHall"]), "see")).toBe(false);
    expect(isSight(sight("Q3", ["musicVenue"]), "see")).toBe(false);
    expect(isSight(sight("Q4", ["theatre"]), "viewpoint")).toBe(false);
  });

  it("keeps opera houses and World Heritage (Palais Garnier, the Liceu, Palau de la Música) as before", () => {
    expect(isSight(sight("Q187840", ["musicVenue", "opera"]), "see")).toBe(true);
    expect(isSight(sight("Q1130050", ["concertHall", "opera"]), "see")).toBe(true);
    expect(isSight(sight("Q327940", ["concertHall", "unesco"]), "see")).toBe(true);
    expect(isSight(sight("Q1328165", ["musicVenue", "ruins"]), "see")).toBe(true);
    // Hamburg State Opera is also filed as a business (its company).
    expect(isSight(sight("Q156213", ["business", "heritage", "musicVenue", "opera"]), "see")).toBe(true);
  });

  it("always leaves nightclubs and cinemas out of sights, listed or not; a museum stays a museum", () => {
    expect(isSight(sight("Q5", ["heritage", "nightclub"]), "see")).toBe(false);
    expect(isSight(sight("Q6", ["cinema", "heritage", "unesco"]), "see")).toBe(false);
    expect(isSight(sight("Q1538389", ["cinema", "museum"]), "museum")).toBe(true);
  });

  it("drops stations, hotels and districts Wikidata alone suggests, keeps them when OSM tags them, never keeps states", () => {
    expect(isSight(sight("Q7", ["station"]), "see")).toBe(false);
    expect(isSight(sight("Q8", ["station"], false), "see")).toBe(true);
    expect(isSight(sight("Q10285", ["museum", "ruins", "sportsVenue"]), "see")).toBe(true);
    expect(isSight(sight("Q9", ["street", "unesco"]), "see")).toBe(true);
    expect(isSight(sight("Q1", ["business", "heritage", "school"]), "see")).toBe(true);
    expect(isSight(sight("Q2", ["office"]), "see")).toBe(false);
    expect(isSight(sight("Q3", ["heritage", "office", "station"]), "see")).toBe(false);
    expect(isSight(sight("Q237", ["country", "unesco"]), "see")).toBe(false);
    expect(isSight(sight("Q10", ["adminArea"], false), "see")).toBe(false);
    // Wikidata files the Eiffel Tower and the Château de Vincennes under districts too: buildings stay.
    expect(isSight(sight("Q243", ["adminArea", "attraction", "heritage", "tower"], false), "see")).toBe(true);
    expect(isSight(sight("Q11", ["adminArea", "castle", "heritage"]), "see")).toBe(true);
    expect(isSight(sight("Q12", ["adminArea", "road", "street"]), "see")).toBe(false);
  });

  it("lets the overrides include and exclude, before any rule", () => {
    const overrides = {
      include: [{ qid: "Q673223", name: "Elbphilharmonie", reason: "landmark" }],
      exclude: [{ qid: "Q810700", name: "Bataclan", reason: "not a sight" }],
    };
    expect(isSight(sight("Q673223", ["concertHall"]), "see", overrides)).toBe(true);
    expect(isSight(sight("Q810700", ["heritage", "musicVenue"]), "see", overrides)).toBe(false);
  });

  it("marks streets, squares, bridges and promenades as walk-through, not the Roman Forum or a palace", () => {
    expect(["street", "square", "bridge", "promenade"].map((k) => isWalkThrough(sight("Q1", [k as KindTag])))).toEqual([true, true, true, true]);
    expect(isWalkThrough(sight("Q180212", ["ruins", "square"]))).toBe(false);
    expect(isWalkThrough(sight("Q131631", ["palace", "square"]))).toBe(false);
    expect(isWalkThrough(sight("Q2", ["museum"]))).toBe(false);
  });
});

describe("wrong links (rule 1) and residences (rule 2)", () => {
  it("drops links to items far away, to events, people and ideas without a coordinate, and to universities", () => {
    expect(hasWrongLink(sight("Q12246908", ["farFromItem"], false), "see")).toBe(true);
    expect(hasWrongLink(sight("Q178841", ["noCoordinate", "notPlace"], false), "see")).toBe(true);
    expect(hasWrongLink(sight("Q183231", ["noCoordinate", "organization"], false), "see")).toBe(true);
    expect(hasWrongLink(sight("Q214654", ["heritage", "organization", "university"], false), "museum")).toBe(true);
  });

  it("keeps a museum's own organization item, organizations at the place, sights that are also universities, and Wikidata places", () => {
    expect(hasWrongLink(sight("Q223373", ["noCoordinate", "organization"], false), "museum")).toBe(false);
    expect(hasWrongLink(sight("Q23308", ["organization"], false), "see")).toBe(false);
    expect(hasWrongLink(sight("Q1", ["concertHall", "university"], false), "see")).toBe(false);
    // Trevi Fountain: Wikidata files it under "concept" too, but it has a coordinate.
    expect(hasWrongLink(sight("Q185382", ["notPlace"], false), "see")).toBe(false);
    expect(hasWrongLink(sight("Q2", ["noCoordinate", "notPlace"]), "see")).toBe(false);
  });

  it("lets a relink override settle a link", () => {
    const relinked = { ...sight("Q856559", ["noCoordinate", "organization"], false), id: "node/429638456" };
    const relink = [{ osmId: "node/429638456", from: "Q204221", qid: "Q856559", name: "Book of Kells", reason: "test" }];
    expect(hasWrongLink(relinked, "see", { relink })).toBe(false);
  });

  it("finds official residences and seats of government, unless also a museum or ruins", () => {
    expect(isResidence(sight("Q188190", ["heritage", "palace", "residence"]))).toBe(true);
    expect(isResidence(sight("Q42182", ["museum", "palace", "residence"]))).toBe(false);
    expect(isResidence(sight("Q62408", ["heritage", "office"]))).toBe(false);
  });
});

describe("applyPlaceRules", () => {
  const file = (see: StoredPlace[]): PlacesFile =>
    ({
      version: 3,
      cityCode: "PAR",
      categories: {
        see: { status: "ok", wikipediaCountsAvailable: true, places: see },
        museum: { status: "missing", reason: "test" },
        restaurant: { status: "ok", wikipediaCountsAvailable: true, places: [sight("Q50", ["nightclub"])] },
      },
    }) as unknown as PlacesFile;

  it("filters sights, applies the city's overrides, caps at 40 and hides the raw kinds", () => {
    const places = [
      sight("Q810700", ["heritage", "musicVenue"]),
      sight("Q550", ["street"], false),
      sight("Q1", ["nightclub"]),
      ...Array.from({ length: 45 }, (_, i) => sight(`Q${100 + i}`)),
    ];
    const shown = applyPlaceRules(file(places));
    const see = shown.categories.see;
    if (see.status !== "ok") throw new Error("see");
    // The Bataclan is excluded by src/data/place-overrides.ts, the club by the rules.
    expect(see.places.map((p) => p.wikidataId).slice(0, 2)).toEqual(["Q550", "Q100"]);
    expect(see.places).toHaveLength(40);
    expect(see.places[0]).toEqual({ id: "way/550", name: "Q550", lat: 48.86, lon: 2.35, wikidataId: "Q550", walkThrough: true });
    expect(see.places.some((p) => "kinds" in p)).toBe(false);
    expect(shown.categories.museum.status).toBe("missing");
    // A wrong link loses its count and moves down; a residence is shown but marked as no visit.
    const ranked = applyPlaceRules(
      file([
        { ...sight("Q178841", ["noCoordinate", "notPlace"], false), wikipediaCount: 65 },
        { ...sight("Q188190", ["palace", "residence"]), wikipediaCount: 64 },
        { ...sight("Q10", [], false), wikipediaCount: 20 },
      ]),
    );
    if (ranked.categories.see.status !== "ok") throw new Error("see");
    expect(ranked.categories.see.places.map((p) => [p.name, p.wikipediaCount, p.wikidataId, p.noVisit])).toEqual([
      ["Q188190", 64, "Q188190", true],
      ["Q10", 20, "Q10", undefined],
      ["Q178841", undefined, undefined, undefined],
    ]);
    // An included place can carry its own visit length.
    const moulin = applyPlaceRules(file([sight("Q151030", ["business", "musicVenue"])]));
    expect(moulin.categories.see.status === "ok" && moulin.categories.see.places[0]).toMatchObject({ wikidataId: "Q151030", visitMin: 30 });
    // Food and drink are not sights: the rules leave them alone.
    const food = shown.categories.restaurant;
    expect(food.status === "ok" && food.places).toHaveLength(1);
  });
});

describe("overrides on read", () => {
  const one = (place: StoredPlace, code: string) =>
    ({
      version: 3,
      cityCode: code,
      categories: { see: { status: "ok", wikipediaCountsAvailable: true, places: [place] } },
    }) as unknown as PlacesFile;
  const first = (f: ReturnType<typeof applyPlaceRules>) => (f.categories.see.status === "ok" ? f.categories.see.places[0] : undefined);

  it("opens a residence visitors can enter, and marks exterior-only places with their months and note", () => {
    expect(first(applyPlaceRules(one(sight("Q505950", ["palace", "residence"]), "EDI")))?.noVisit).toBeUndefined();
    expect(first(applyPlaceRules(one(sight("Q936633", ["office", "palace"], false), "PAR")))?.exterior).toEqual({});
    expect(first(applyPlaceRules(one(sight("Q42182", ["museum", "palace", "residence"]), "LON")))?.exterior).toEqual({
      visitMin: 30,
      openMonths: [7, 8, 9],
      note: "Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma",
    });
  });
});
