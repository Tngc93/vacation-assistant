import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { placesFileSchema } from "@/lib/places/file";
import { applyPlaceRules } from "@/lib/places/rules";

/**
 * Places a traveller expects in each city, by Wikidata item (labels checked
 * against Wikidata on 2026-10-17). The test reads the stored files: no network.
 * A miss means the data script lost a must-see place.
 */
export const CANON: Record<string, Record<string, string>> = {
  BCN: {
    Q48435: "Sagrada Família",
    Q461371: "Casa Batlló",
    Q207870: "Casa Milà",
    Q212867: "Park Güell",
    Q1050032: "Museu Picasso",
    Q17155: "Barcelona Cathedral",
  },
  PAR: {
    Q243: "Eiffel Tower",
    Q19675: "Louvre Museum",
    Q2981: "Notre-Dame de Paris",
    Q28785: "Sacré-Cœur",
    Q64436: "Arc de Triomphe",
  },
  ROM: {
    Q10285: "Colosseum",
    Q185382: "Trevi Fountain",
    Q99309: "Pantheon",
    Q180212: "Roman Forum",
  },
  LON: {
    Q6373: "British Museum",
    Q62378: "Tower of London",
    Q62408: "Palace of Westminster",
    Q83125: "Tower Bridge",
  },
  AMS: {
    Q190804: "Rijksmuseum",
    Q224124: "Van Gogh Museum",
    Q165366: "Anne Frank House",
  },
  SJJ: {
    Q629641: "Baščaršija",
    Q1277685: "Latin Bridge",
  },
};

/** What the guide and the plan show: the stored file with the sight rules and overrides applied. */
const shown = (code: string) => applyPlaceRules(placesFileSchema.parse(JSON.parse(readFileSync(path.join(__dirname, `${code}.json`), "utf8"))));
const placesIn = (code: string, category: "see" | "museum" | "viewpoint") => {
  const entry = shown(code).categories[category];
  return entry.status === "ok" ? entry.places : [];
};
const sightsOf = (code: string) => {
  const file = shown(code);
  return (["see", "museum", "viewpoint"] as const).flatMap((c) => {
    const entry = file.categories[c];
    return entry.status === "ok" ? entry.places : [];
  });
};

describe("must-see canon", () => {
  describe.each(Object.entries(CANON))("%s", (code, canon) => {
    const places = sightsOf(code);
    it.each(Object.entries(canon))("has %s (%s)", (qid) => {
      expect(places.some((p) => p.wikidataId === qid)).toBe(true);
    });
  });
});

/** Listed concert halls and opera houses are sights; an override brings in the Elbphilharmonie and keeps the Bataclan out. */
export const STAGES: Record<string, Record<string, string>> = {
  LON: { Q193639: "Royal Albert Hall" },
  HAM: { Q673223: "Elbphilharmonie" },
  AMS: { Q849957: "Concertgebouw" },
  VIE: { Q686720: "Musikverein" },
  PRG: { Q1130137: "Rudolfinum" },
  PAR: { Q187840: "Palais Garnier" },
  BCN: { Q1130050: "Gran Teatre del Liceu" },
};

describe("sights are places to visit", () => {
  describe.each(Object.entries(STAGES))("%s", (code, stages) => {
    const see = placesIn(code, "see");
    it.each(Object.entries(stages))("shows %s (%s) among the sights", (qid) => {
      expect(see.some((p) => p.wikidataId === qid)).toBe(true);
    });
  });

  it("does not show the Bataclan", () => {
    expect(sightsOf("PAR").some((p) => p.wikidataId === "Q810700")).toBe(false);
  });

  it("marks streets, squares and bridges as walk-through (the Champs-Élysées, Charles Bridge), not the Roman Forum", () => {
    expect(sightsOf("PAR").find((p) => p.wikidataId === "Q550")?.walkThrough).toBe(true);
    expect(sightsOf("PRG").find((p) => p.wikidataId === "Q204871")?.walkThrough).toBe(true);
    expect(sightsOf("ROM").find((p) => p.wikidataId === "Q180212")?.walkThrough).toBeUndefined();
  });
});

describe("the Vatican, seen from Rome", () => {
  it("labels St Peter's, the Sistine Chapel and the Vatican Museums with their country, whatever their source", () => {
    const rome = sightsOf("ROM");
    for (const qid of ["Q12512", "Q2943", "Q182955"]) expect(rome.find((p) => p.wikidataId === qid)?.country, qid).toBe("VA");
    expect(rome.find((p) => p.wikidataId === "Q10285")?.country).toBeUndefined();
  });
});
