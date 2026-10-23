import { describe, expect, it } from "vitest";
import { chooseParents, parentsQuery, parseParents, type ParentCandidate } from "./containment";
import type { StoredPlace } from "./file";

// Around the Moscow Kremlin (55.7520, 37.6175).
const place = (qid: string, lat: number, lon: number, extra: Partial<StoredPlace> = {}): StoredPlace => ({
  id: `wikidata/${qid}`,
  name: qid,
  lat,
  lon,
  wikidataId: qid,
  ...extra,
});
// An area too, but also a visited place: a parent.
const kremlin = place("Q1", 55.752, 37.6175, { name: "Московский Кремль", wikipediaCount: 91, kinds: ["adminArea", "attraction", "heritage"] });
const bell = place("Q2", 55.7511, 37.6176, { wikipediaCount: 42 });
const cannon = place("Q3", 55.7519, 37.6177, { wikipediaCount: 42 });
const palace = place("Q4", 55.7505, 37.6155, { wikipediaCount: 33, kinds: ["palace"] });
const chamber = place("Q5", 55.751, 37.6165, { wikipediaCount: 20 });
const candidate = (qid: string, sitelinks: number, trLabel?: string): ParentCandidate => ({ qid, sitelinks, ...(trLabel ? { trLabel } : {}) });

describe("chooseParents", () => {
  it("links children to the place they are in, with its Turkish label", () => {
    const parents = chooseParents(
      [kremlin, bell, cannon],
      new Map([
        ["Q2", [candidate("Q1", 120, "Moskova Kremlini")]],
        ["Q3", [candidate("Q1", 120, "Moskova Kremlini")]],
      ]),
    );
    expect(Object.fromEntries(parents)).toEqual({
      Q2: { parentId: "Q1", parentName: "Moskova Kremlini" },
      Q3: { parentId: "Q1", parentName: "Moskova Kremlini" },
    });
  });

  it("falls back to the parent's stored name without a Turkish label", () => {
    const parents = chooseParents([kremlin, bell], new Map([["Q2", [candidate("Q1", 120)]]]));
    expect(parents.get("Q2")).toEqual({ parentId: "Q1", parentName: "Московский Кремль" });
  });

  it("picks the candidate with more sitelinks", () => {
    const parents = chooseParents([kremlin, palace, chamber], new Map([["Q5", [candidate("Q4", 60), candidate("Q1", 120)]]]));
    expect(parents.get("Q5")?.parentId).toBe("Q1");
  });

  it("keeps one level: a grandchild hangs on the top place", () => {
    const parents = chooseParents(
      [kremlin, palace, chamber],
      new Map([
        ["Q4", [candidate("Q1", 120)]],
        ["Q5", [candidate("Q4", 60)]],
      ]),
    );
    expect(Object.fromEntries([...parents].map(([k, v]) => [k, v.parentId]))).toEqual({ Q4: "Q1", Q5: "Q1" });
  });

  it("survives a cycle: A in B and B in A keeps the better-known one on top", () => {
    const a = place("Q10", 55.752, 37.6175, { wikipediaCount: 40 });
    const b = place("Q11", 55.7521, 37.6176, { wikipediaCount: 40 });
    const parents = chooseParents(
      [a, b],
      new Map([
        ["Q10", [candidate("Q11", 50)]],
        ["Q11", [candidate("Q10", 80)]],
      ]),
    );
    // Q10 has more sitelinks, so it is the top place and Q11 is inside it.
    expect(Object.fromEntries(parents)).toEqual({ Q11: { parentId: "Q10", parentName: "Q10" } });
  });

  it("survives a longer cycle", () => {
    const a = place("Q20", 55.752, 37.6175, { wikipediaCount: 30 });
    const b = place("Q21", 55.7521, 37.6176, { wikipediaCount: 30 });
    const c = place("Q22", 55.7522, 37.6177, { wikipediaCount: 30 });
    const parents = chooseParents(
      [a, b, c],
      new Map([
        ["Q20", [candidate("Q21", 40)]],
        ["Q21", [candidate("Q22", 90)]],
        ["Q22", [candidate("Q20", 40)]],
      ]),
    );
    expect(Object.fromEntries([...parents].map(([k, v]) => [k, v.parentId]))).toEqual({ Q20: "Q22", Q21: "Q22" });
  });

  it("ignores a far, less known, walk-through, road, area or country parent, and items outside the city's list", () => {
    const far = place("Q30", 55.76, 37.6175, { wikipediaCount: 100 });
    const square = place("Q31", 55.7521, 37.6176, { wikipediaCount: 98, kinds: ["square"] });
    const country = place("Q32", 55.7521, 37.6176, { wikipediaCount: 200, kinds: ["country"] });
    const road = place("Q35", 55.7521, 37.6176, { wikipediaCount: 90, kinds: ["road"] });
    const oldTown = place("Q36", 55.7521, 37.6176, { wikipediaCount: 90, kinds: ["adminArea"] });
    const medina = place("Q37", 55.7521, 37.6176, { wikipediaCount: 90, kinds: ["heritage", "unesco"] });
    const field = place("Q33", 55.7521, 37.6176, { wikipediaCount: 56 });
    const tower = place("Q34", 55.752, 37.6175, { wikipediaCount: 177 });
    const parents = chooseParents(
      [far, square, country, road, oldTown, medina, field, tower, bell],
      new Map([
        ["Q2", [candidate("Q30", 200), candidate("Q31", 150), candidate("Q32", 300), candidate("Q35", 100), candidate("Q36", 100), candidate("Q37", 100), candidate("Q99", 500)]],
        ["Q34", [candidate("Q33", 90)]],
      ]),
    );
    expect(parents.size).toBe(0);
  });
});

describe("parseParents", () => {
  it("reads P361/P276 rows with sitelinks and the Turkish label", () => {
    const row = (item: string, parent: string, sitelinks: string, tr?: string) => ({
      item: { value: `http://www.wikidata.org/entity/${item}` },
      parent: { value: `http://www.wikidata.org/entity/${parent}` },
      sitelinks: { value: sitelinks },
      ...(tr ? { tr: { value: tr } } : {}),
    });
    const parsed = parseParents({
      results: { bindings: [row("Q2", "Q1", "120", "Moskova Kremlini"), row("Q2", "Q1", "120"), row("Q3", "Q3", "5"), row("Q3", "Q1", "120")] },
    });
    expect(Object.fromEntries(parsed)).toEqual({
      Q2: [{ qid: "Q1", sitelinks: 120, trLabel: "Moskova Kremlini" }],
      Q3: [{ qid: "Q1", sitelinks: 120 }],
    });
    expect(parentsQuery(["Q2"])).toContain("wdt:P361|wdt:P276");
  });
});
