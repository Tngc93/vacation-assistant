import { describe, expect, it, vi } from "vitest";
import type { Fetcher } from "./overpass";
import {
  candidatesQuery,
  classify,
  fetchLandmarks,
  fetchKinds,
  kindsQuery,
  parseCandidates,
  parseKinds,
  parseTypeClasses,
  typesQuery,
  type Candidate,
} from "./landmarks";

const row = (qid: string, types: string, extra: Record<string, string> = {}) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  coord: { value: "Point(2.17 41.39)" },
  dist: { value: "1.2" },
  types: { value: types },
  ccs: { value: "ES" },
  ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])),
});
const json = (bindings: unknown[]) => ({ results: { bindings } });
const cand = (qid: string, types: string[], over: Partial<Candidate> = {}): Candidate => ({
  qid,
  lat: 41.39,
  lon: 2.17,
  distKm: 1,
  countries: ["ES"],
  types,
  ...over,
});
// Q1 is a building subtype, Q2 a stadium (sports venue), Q3 a museum, Q4 an archaeological site, Q5 a park, Q6 a district.
const typeClasses = new Map([
  ["Q1", new Set(["Q41176"])],
  ["Q2", new Set(["Q41176", "Q1076486"])],
  ["Q3", new Set(["Q33506"])],
  ["Q4", new Set(["Q839954"])],
  ["Q5", new Set(["Q22698"])],
  ["Q6", new Set(["Q56061", "Q358"])],
  ["Q7", new Set(["Q133442", "Q570116"])],
]);

describe("Wikidata landmarks", () => {
  it("asks for items around the centre, without demolished ones, and for the types' classes", () => {
    const q = candidatesQuery(41.3825, 2.1769, 6);
    expect(q).toContain('"Point(2.1769 41.3825)"^^geo:wktLiteral');
    expect(q).toContain('wikibase:radius "6"');
    expect(q).toContain("FILTER NOT EXISTS { ?item wdt:P576 ?demolished }");
    expect(typesQuery(["Q1", "Q2"])).toContain("VALUES ?type { wd:Q1 wd:Q2 }");
  });

  it("reads candidates, keeping the nearest point of an item with several coordinates", () => {
    const parsed = parseCandidates(
      json([row("Q10", "Q1 Q3", { dist: "2.5" }), row("Q10", "Q1 Q3", { dist: "1.1", coord: "Point(2.2 41.4)" }), row("Q11", "Q5")]),
    );
    expect(parsed).toEqual([
      { qid: "Q10", lat: 41.4, lon: 2.2, distKm: 1.1, countries: ["ES"], types: ["Q1", "Q3"] },
      { qid: "Q11", lat: 41.39, lon: 2.17, distKm: 1.2, countries: ["ES"], types: ["Q5"] },
    ]);
    expect(parseTypeClasses(json([{ type: { value: "x/Q1" }, class: { value: "x/Q41176" } }]))).toEqual(new Map([["Q1", new Set(["Q41176"])]]));
  });

  it("keeps any sight type, even stadiums and districts (the read-time rules decide), and drops what is no sight type", () => {
    const kept = classify(
      [
        cand("Q100", ["Q1"]),
        cand("Q101", ["Q2"]), // Camp Nou
        cand("Q102", ["Q2", "Q4", "Q3"]), // the Colosseum
        cand("Q103", ["Q6"]), // Ciutat Vella
        cand("Q104", ["Q9"]), // nothing we know
      ],
      typeClasses,
      "ES",
    );
    expect(kept.map((k) => k.qid)).toEqual(["Q100", "Q101", "Q102", "Q103"]);
  });

  it("files a museum that is also a park or archaeological site as a sight", () => {
    const [plain, park, colosseum] = classify([cand("Q1", ["Q3"]), cand("Q2", ["Q3", "Q5"]), cand("Q3", ["Q3", "Q4"])], typeClasses, "ES");
    expect([plain.museum, park.museum, colosseum.museum]).toEqual([true, false, false]);
  });

  it("keeps the destination's country and the Vatican, leaves other countries out, keeps unknown countries", () => {
    const kept = classify(
      [cand("Q1", ["Q1"], { countries: ["IT"] }), cand("Q2", ["Q1"], { countries: ["VA"] }), cand("Q3", ["Q1"], { countries: ["FR"] }), cand("Q4", ["Q1"], { countries: [] })],
      typeClasses,
      "IT",
    );
    expect(kept.map((k) => k.qid)).toEqual(["Q1", "Q2", "Q4"]);
  });

  it("keeps far places only when they are very well known, with labels and Wikipedia counts", async () => {
    const fetcher = vi.fn<Fetcher>(async (url, init) => {
      if (url.startsWith("https://query.wikidata.org")) {
        const query = new URLSearchParams(String(init.body)).get("query") ?? "";
        if (query.includes("wikibase:around")) {
          return Response.json(json([row("Q1", "Q5", { dist: "4.0" }), row("Q2", "Q5", { dist: "4.5" }), row("Q3", "Q5", { dist: "1.0" })]));
        }
        return Response.json(json([{ type: { value: "x/Q5" }, class: { value: "x/Q22698" } }]));
      }
      // Wikipedia sitelink keys are letters only ("enwiki", "trwiki").
      const sitelinks = (n: number) =>
        Object.fromEntries(Array.from({ length: n }, (_, i) => [`${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}wiki`, {}]));
      return Response.json({
        entities: {
          Q1: { sitelinks: sitelinks(52), labels: { tr: { value: "Güell Parkı" }, en: { value: "Park Güell" } } },
          Q2: { sitelinks: sitelinks(12), labels: { en: { value: "Suburban park" } } },
          Q3: { sitelinks: sitelinks(25), labels: { en: { value: "Parc de la Ciutadella" } } },
        },
      });
    });
    const list = await fetchLandmarks({ lat: 41.3825, lon: 2.1769, radiusKm: 3, countryCode: "ES" }, { fetcher });
    expect(list.map((l) => [l.qid, l.name, l.wikipedias])).toEqual([
      ["Q1", "Güell Parkı", 52],
      ["Q3", "Parc de la Ciutadella", 25],
    ]);
    expect(list[0].enLabel).toBe("Park Güell");
    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init.headers).get("User-Agent")).toMatch(/^VacationAssistant\//);
  });
});

describe("Wikidata kinds of sights", () => {
  const rows = (pairs: Array<[string, string]>) =>
    json(pairs.map(([item, cls]) => ({ item: { value: `http://www.wikidata.org/entity/${item}` }, class: { value: cls.startsWith("Q") ? `http://www.wikidata.org/entity/${cls}` : cls } })));

  it("asks for the rule classes through subclass paths, and for heritage listings", () => {
    const q = kindsQuery(["Q810700", "Q550"]);
    expect(q).toContain("VALUES ?item { wd:Q810700 wd:Q550 }");
    expect(q).toContain("SELECT DISTINCT ?item ?class");
    expect(q).toContain("?item wdt:P31 ?type . ?type wdt:P279* ?class");
    expect(q).toContain('hint:optimizer "None"');
    expect(q).toContain("wd:Q1060829");
    expect(q).toContain("?item wdt:P1435 ?listing");
    expect(q).toContain("wd:Q9259");
  });

  it("maps classes to short tags, a World Heritage Site being a heritage listing too", () => {
    const kinds = parseKinds(
      rows([
        ["Q193639", "Q1060829"], // Royal Albert Hall: concert hall, listed
        ["Q193639", "heritage"],
        ["Q327940", "Q1060829"], // Palau de la Música Catalana
        ["Q327940", "unesco"],
        ["Q550", "Q79007"], // Champs-Élysées: street (and pedestrian street, same tag)
        ["Q550", "Q62685721"],
        ["Q1", "Q41176"], // a class the rules do not use
      ]),
    );
    expect(kinds).toEqual(
      new Map([
        ["Q193639", ["concertHall", "heritage"]],
        ["Q327940", ["concertHall", "heritage", "unesco"]],
        ["Q550", ["street"]],
      ]),
    );
  });

  it("asks in batches and merges the answers", async () => {
    const fetcher = vi.fn<Fetcher>(async (_url, init) => {
      const query = new URLSearchParams(String(init.body)).get("query") ?? "";
      return Response.json(query.includes("wd:Q810700") ? rows([["Q810700", "Q8719053"]]) : rows([["Q550", "Q79007"]]));
    });
    const ids = ["Q810700", ...Array.from({ length: 100 }, (_, i) => `Q${1000 + i}`), "Q550"];
    const kinds = await fetchKinds(ids, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(kinds).toEqual(new Map([["Q810700", ["musicVenue"]], ["Q550", ["street"]]]));
  });
});
