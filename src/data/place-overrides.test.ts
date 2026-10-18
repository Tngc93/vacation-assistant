import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { placesFileSchema } from "@/lib/places/file";
import { PLACE_OVERRIDES } from "./place-overrides";

const storedPlaces = (code: string) => {
  const file = placesFileSchema.parse(JSON.parse(readFileSync(path.join(__dirname, "places", `${code}.json`), "utf8")));
  return (["see", "museum", "viewpoint"] as const).flatMap((c) => {
    const entry = file.categories[c];
    return entry.status === "ok" ? entry.places : [];
  });
};
const storedQids = (code: string) => new Set(storedPlaces(code).flatMap((p) => p.wikidataId ?? []));

describe("place overrides", () => {
  it("holds the agreed exceptions", () => {
    expect(PLACE_OVERRIDES.HAM?.include?.map((o) => o.qid)).toEqual(["Q673223"]);
    expect(PLACE_OVERRIDES.PAR?.exclude?.map((o) => o.qid)).toEqual(["Q810700", "Q193582"]);
    expect(PLACE_OVERRIDES.EDI?.open?.map((o) => o.qid)).toEqual(["Q505950"]);
    expect(PLACE_OVERRIDES.LON?.exclude?.map((o) => o.qid)).toEqual(["Q184619"]);
    expect(PLACE_OVERRIDES.MUC?.exclude?.map((o) => o.qid)).toEqual(["Q102400"]);
    const exterior = Object.entries(PLACE_OVERRIDES).flatMap(([code, o]) => (o.exteriorOnly ?? []).map((e) => `${code}:${e.qid}`));
    expect(exterior.sort()).toEqual(["BER:Q317027", "LON:Q41225", "LON:Q42182", "MOW:Q844124", "PAR:Q936633", "SOF:Q639704"]);
    expect(PLACE_OVERRIDES.LON?.exteriorOnly?.find((e) => e.qid === "Q42182")).toMatchObject({ visitMin: 30, openMonths: [7, 8, 9] });
    expect(PLACE_OVERRIDES.LON?.exteriorOnly?.find((e) => e.qid === "Q41225")).toMatchObject({ visitMin: 30 });
    expect(PLACE_OVERRIDES.LON?.relink?.map((r) => [r.from, r.qid])).toEqual([["Q37733713", "Q41225"]]);
    expect(PLACE_OVERRIDES.NYC?.relink?.map((r) => [r.from, r.qid])).toEqual([["Q10806", "Q1136137"]]);
    expect(PLACE_OVERRIDES.DUB?.relink?.map((r) => [r.from, r.qid])).toEqual([["Q204221", "Q856559"]]);
    expect(PLACE_OVERRIDES.PAR?.include?.map((o) => [o.qid, o.visitMin])).toEqual([["Q151030", 30]]);
  });

  describe.each(Object.entries(PLACE_OVERRIDES))("%s", (code, overrides) => {
    const entries = [...(overrides.include ?? []), ...(overrides.exclude ?? []), ...(overrides.open ?? []), ...(overrides.exteriorOnly ?? [])];
    const relinks = overrides.relink ?? [];

    it("is a destination, and each entry has a Wikidata item and a one-line reason", () => {
      expect(DESTINATIONS.some((d) => d.cityCode === code)).toBe(true);
      for (const o of entries) {
        expect(o.qid).toMatch(/^Q[1-9]\d*$/);
        expect(o.name.trim()).not.toBe("");
        expect(o.reason.trim()).not.toBe("");
        expect(o.reason).not.toMatch(/\n/);
        if (o.visitMin !== undefined) expect(Number.isInteger(o.visitMin) && o.visitMin > 0).toBe(true);
      }
      for (const e of overrides.exteriorOnly ?? []) {
        for (const m of e.openMonths ?? []) expect(Number.isInteger(m) && m >= 1 && m <= 12).toBe(true);
        if (e.note !== undefined) expect(e.note).toMatch(/^[^\n]+$/);
      }
      for (const r of relinks) {
        expect([r.from, r.qid].every((q) => /^Q[1-9]\d*$/.test(q))).toBe(true);
        expect(r.reason).toMatch(/^[^\n]+$/);
      }
      expect(new Set(entries.map((o) => o.qid)).size).toBe(entries.length);
    });

    it("names only items that are in the city's data", () => {
      const stored = storedQids(code);
      for (const o of entries) expect(stored.has(o.qid), `${o.qid} (${o.name}) is not in ${code}.json`).toBe(true);
      // A relink is applied by `npm run data:kinds`: the OSM object carries the right item, and no copy of it is left.
      const places = storedPlaces(code);
      for (const r of relinks) {
        expect(places.find((p) => p.id === r.osmId)?.wikidataId, `${r.osmId} in ${code}.json: run npm run data:kinds`).toBe(r.qid);
        expect(places.some((p) => p.id === `wikidata/${r.qid}`)).toBe(false);
      }
    });
  });
});
