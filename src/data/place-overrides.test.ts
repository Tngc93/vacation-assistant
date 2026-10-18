import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { placesFileSchema } from "@/lib/places/file";
import { PLACE_OVERRIDES } from "./place-overrides";

const storedQids = (code: string) => {
  const file = placesFileSchema.parse(JSON.parse(readFileSync(path.join(__dirname, "places", `${code}.json`), "utf8")));
  return new Set(
    (["see", "museum", "viewpoint"] as const).flatMap((c) => {
      const entry = file.categories[c];
      return entry.status === "ok" ? entry.places.flatMap((p) => p.wikidataId ?? []) : [];
    }),
  );
};

describe("place overrides", () => {
  it("holds the agreed exceptions: Elbphilharmonie in, Bataclan out", () => {
    expect(PLACE_OVERRIDES.HAM?.include?.map((o) => o.qid)).toEqual(["Q673223"]);
    expect(PLACE_OVERRIDES.PAR?.exclude?.map((o) => o.qid)).toEqual(["Q810700"]);
    expect(PLACE_OVERRIDES.PAR?.include?.map((o) => [o.qid, o.visitMin])).toEqual([["Q151030", 30]]);
  });

  describe.each(Object.entries(PLACE_OVERRIDES))("%s", (code, overrides) => {
    const entries = [...(overrides.include ?? []), ...(overrides.exclude ?? [])];

    it("is a destination, and each entry has a Wikidata item and a one-line reason", () => {
      expect(DESTINATIONS.some((d) => d.cityCode === code)).toBe(true);
      for (const o of entries) {
        expect(o.qid).toMatch(/^Q[1-9]\d*$/);
        expect(o.name.trim()).not.toBe("");
        expect(o.reason.trim()).not.toBe("");
        expect(o.reason).not.toMatch(/\n/);
        if (o.visitMin !== undefined) expect(Number.isInteger(o.visitMin) && o.visitMin > 0).toBe(true);
      }
      expect(new Set(entries.map((o) => o.qid)).size).toBe(entries.length);
    });

    it("names only items that are in the city's data", () => {
      const stored = storedQids(code);
      for (const o of entries) expect(stored.has(o.qid), `${o.qid} (${o.name}) is not in ${code}.json`).toBe(true);
    });
  });
});
