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
    const list = (kind: "include" | "exclude" | "open" | "exteriorOnly" | "visit") =>
      Object.entries(PLACE_OVERRIDES)
        .flatMap(([code, o]) => (o[kind] ?? []).map((e) => `${code}:${e.qid}${e.visitMin ? `:${e.visitMin}` : ""}`))
        .sort();
    expect(list("include")).toEqual(["BRU:Q180901", "HAM:Q673223", "PAR:Q151030:30"]);
    expect(list("exclude")).toEqual(["ATH:Q2070605", "ATH:Q755221", "ATH:Q844930", "LON:Q184619", "MUC:Q102400", "PAR:Q193582", "PAR:Q810700"]);
    expect(list("open")).toEqual(["EDI:Q505950", "MOW:Q133274:180"]);
    expect(list("visit")).toEqual(["MOW:Q191414:30"]);
    expect(list("exteriorOnly")).toEqual([
      "BCN:Q631075:15",
      "BER:Q317027",
      "BER:Q82425:20",
      "BRU:Q152072:15",
      "DUB:Q1134365:15",
      "GVA:Q684661:20",
      "HEL:Q523268:15",
      "LED:Q672444:20",
      "LED:Q907366:15",
      "LON:Q41225:30",
      "LON:Q42182:30",
      "LON:Q842089:15",
      "MOW:Q147875:15",
      "MOW:Q147881:15",
      "MOW:Q2075146:15",
      "MOW:Q844124",
      "PAR:Q631104:15",
      "PAR:Q936633",
      "PRG:Q1630131:20",
      "RIX:Q337179:15",
      "ROM:Q185382:30",
      "ROM:Q265384:15",
      "ROM:Q848072:30",
      "SOF:Q639704",
      "WAW:Q958585:15",
    ]);
    expect(PLACE_OVERRIDES.BRU?.include?.[0]).toMatchObject({ remote: true });
    expect(PLACE_OVERRIDES.LON?.exteriorOnly?.find((e) => e.qid === "Q42182")).toMatchObject({ openMonths: [7, 8, 9] });
    const relinks = Object.entries(PLACE_OVERRIDES).flatMap(([code, o]) => (o.relink ?? []).map((r) => `${code}:${r.from}>${r.qid}`));
    expect(relinks.sort()).toEqual(["DUB:Q204221>Q856559", "LON:Q37733713>Q41225", "NYC:Q10806>Q1136137"]);
  });

  describe.each(Object.entries(PLACE_OVERRIDES))("%s", (code, overrides) => {
    const entries = [
      ...(overrides.include ?? []),
      ...(overrides.exclude ?? []),
      ...(overrides.open ?? []),
      ...(overrides.exteriorOnly ?? []),
      ...(overrides.visit ?? []),
    ];
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
