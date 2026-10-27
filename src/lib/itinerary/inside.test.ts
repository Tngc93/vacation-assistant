import { describe, expect, it } from "vitest";
import { keepInsideTogether } from "@/lib/ai/assistant";
import { applyEdits, pinnedFromPlan } from "@/lib/ai/edits";
import { candidatesFor, dayWindows } from "@/lib/ai/prompts";
import { buildIcs } from "./ics";
import { buildItinerary, type ItineraryInput, type PlanPlace } from "./plan";

// Moscow, Sat 14 → Tue 17 Nov 2026: the Kremlin with the Tsar Bell, the Tsar Cannon and the Armoury inside it.
const at = (id: string, name: string, lat: number, lon: number, extra: Partial<PlanPlace> = {}): PlanPlace => ({
  id,
  name,
  lat,
  lon,
  category: "see",
  ...extra,
});
const KREMLIN = at("way/1", "Московский Кремль", 55.752, 37.6175, { wikidataId: "Q1", wikipediaCount: 91 });
const inKremlin = { parentId: "Q1", parentName: "Moskova Kremlini" };
const BELL = at("node/2", "Çar Çanı", 55.7511, 37.6176, { wikidataId: "Q2", wikipediaCount: 42, ...inKremlin });
const CANNON = at("node/3", "Çar Topu", 55.7519, 37.6177, { wikidataId: "Q3", wikipediaCount: 42, ...inKremlin });
// A long museum visit inside it: the Kremlin's visit stretches to it.
const ARMOURY = at("way/4", "Silah Dairesi", 55.7497, 37.6132, {
  wikidataId: "Q4",
  wikipediaCount: 32,
  category: "museum",
  visitMin: 150,
  ...inKremlin,
});
const OTHERS = [
  at("way/10", "Kızıl Meydan", 55.7539, 37.6208, { wikidataId: "Q10", wikipediaCount: 98, walkThrough: true }),
  at("way/11", "Aziz Vasil Katedrali", 55.7525, 37.6231, { wikidataId: "Q11", wikipediaCount: 76 }),
  at("way/12", "Bolşoy Tiyatrosu", 55.7601, 37.6186, { wikidataId: "Q12", wikipediaCount: 60 }),
  at("way/13", "Gorki Parkı", 55.7298, 37.6011, { wikidataId: "Q13", wikipediaCount: 31 }),
  at("way/14", "Tretyakov Galerisi", 55.7414, 37.6208, { wikidataId: "Q14", wikipediaCount: 45, category: "museum" }),
  at("way/15", "Moskova Devlet Üniversitesi", 55.7033, 37.5302, { wikidataId: "Q15", wikipediaCount: 40 }),
  at("way/16", "Novodeviçi Manastırı", 55.7265, 37.5562, { wikidataId: "Q16", wikipediaCount: 50 }),
];
const base: ItineraryInput = {
  depart: "2026-11-14",
  return: "2026-11-17",
  timeZone: "Europe/Moscow",
  flight: null,
  daytime: [KREMLIN, BELL, CANNON, ARMOURY, ...OTHERS],
  evening: [],
  skip: [],
};
const stops = (plan: ReturnType<typeof buildItinerary>) => plan.days.flatMap((d) => d.stops);
const kremlinStop = (plan: ReturnType<typeof buildItinerary>) => stops(plan).find((s) => s.id === KREMLIN.id);
const insideIds = (plan: ReturnType<typeof buildItinerary>) => kremlinStop(plan)?.inside?.map((s) => s.id) ?? [];

describe("places inside another place", () => {
  it("visits the Tsar Bell and the Tsar Cannon with the Kremlin, right after it, with no walk in between", () => {
    const plan = buildItinerary(base);
    const day = plan.days.find((d) => d.stops.some((s) => s.id === KREMLIN.id))!;
    const kremlin = kremlinStop(plan)!;
    // Same day, as sub-stops of the Kremlin, in importance order: never stops of their own anywhere.
    expect(insideIds(plan)).toEqual([BELL.id, CANNON.id, ARMOURY.id]);
    expect(stops(plan).map((s) => s.id)).not.toContain(BELL.id);
    expect(stops(plan).map((s) => s.id)).not.toContain(CANNON.id);
    expect(day.stops.filter((s) => s.kind === "daytime").length).toBeLessThanOrEqual(6);
    // No time and no walk of their own; the caption names the place they are in.
    expect(kremlin.inside![0]).toEqual({
      id: BELL.id,
      shortId: "n2",
      name: "Çar Çanı",
      category: "see",
      lat: BELL.lat,
      lon: BELL.lon,
      hours: "unknown",
      sourceUrl: "https://www.openstreetmap.org/node/2",
      source: "OpenStreetMap",
      within: "Moskova Kremlini",
    });
    expect(kremlin.inside![0]).not.toHaveProperty("travel");
    // The visit lasts as long as the longest of them: the Armoury's 150 minutes, not the Kremlin's own 120.
    expect(kremlin.durationMin).toBe(150);
    // The next stop walks from the Kremlin.
    const next = day.stops[day.stops.indexOf(kremlin) + 1];
    if (next?.kind === "daytime") expect(next.travel).not.toBeNull();
  });

  it("keeps the parent's own visit when the places inside are shorter", () => {
    const plan = buildItinerary({ ...base, daytime: [KREMLIN, BELL, CANNON, ...OTHERS] });
    expect(kremlinStop(plan)?.durationMin).toBe(120);
  });

  it("makes a child a normal stop when its parent is not in the plan", () => {
    const plan = buildItinerary({ ...base, daytime: [BELL, CANNON, ...OTHERS] });
    const bell = stops(plan).find((s) => s.id === BELL.id);
    expect(bell).toBeDefined();
    expect(bell?.inside).toBeUndefined();
    // A residence closed to visitors is not a stop, so what is inside it is planned on its own.
    const closed = buildItinerary({ ...base, daytime: [{ ...KREMLIN, noVisit: true }, BELL, CANNON, ...OTHERS] });
    expect(stops(closed).map((s) => s.id)).toEqual(expect.arrayContaining([BELL.id, CANNON.id]));
  });

  it("removes the children with the parent (?skip=), and bringing the parent back brings them back", () => {
    const removed = buildItinerary({ ...base, skip: ["w1"] });
    const ids = stops(removed).flatMap((s) => [s.id, ...(s.inside ?? []).map((c) => c.id)]);
    expect(ids).not.toContain(KREMLIN.id);
    expect(ids).not.toContain(BELL.id);
    expect(ids).not.toContain(CANNON.id);
    expect(insideIds(buildItinerary({ ...base, skip: [] }))).toEqual([BELL.id, CANNON.id, ARMOURY.id]);
    // One child alone can be removed too.
    expect(insideIds(buildItinerary({ ...base, skip: ["n2"] }))).toEqual([CANNON.id, ARMOURY.id]);
  });

  it("does the same on an edited plan: removing the parent removes them, undo brings them all back", () => {
    const plan = buildItinerary(base);
    const start = { pinned: pinnedFromPlan(plan), pace: "normal" as const, evening: [] };
    expect(start.pinned.flat()).not.toContain(BELL.id);
    const known = new Set(base.daytime.map((p) => p.id));
    const batches = [[{ op: "remove" as const, id: KREMLIN.id }]];
    const edited = buildItinerary({ ...base, pinned: applyEdits(start, batches, known).pinned });
    expect(stops(edited).flatMap((s) => [s.id, ...(s.inside ?? []).map((c) => c.id)])).not.toContain(BELL.id);
    const undone = buildItinerary({ ...base, pinned: applyEdits(start, batches.slice(0, -1), known).pinned });
    expect(insideIds(undone)).toEqual([BELL.id, CANNON.id, ARMOURY.id]);
  });

  it("keeps a chosen child with its chosen parent, whatever day it was given", () => {
    const pinned = [[], [KREMLIN.id, OTHERS[1].id], [BELL.id, OTHERS[2].id], []];
    const plan = buildItinerary({ ...base, pinned });
    expect(plan.days[1].stops.map((s) => s.id)).toEqual([KREMLIN.id, OTHERS[1].id]);
    expect(plan.days[2].stops.map((s) => s.id)).toEqual([OTHERS[2].id]);
    expect(insideIds(plan)).toContain(BELL.id);
    expect(plan.dropped).toEqual([]);
  });

  it("corrects a model that puts a child on another day than its parent", () => {
    const days = dayWindows(buildItinerary(base));
    const candidates = candidatesFor(base.daytime, days, new Set());
    expect(candidates.find((c) => c.id === "n2")?.inside).toBe("w1");
    const answer = {
      days: [
        { day: 2, stops: ["w11", "w1", "w12"], reason: "Kızıl Meydan çevresi." },
        { day: 3, stops: ["n2", "w14"], reason: "Çar Çanı ve galeri." },
      ],
    };
    const fixed = keepInsideTogether(answer, candidates);
    expect(fixed.days.map((d) => d.stops)).toEqual([
      ["w11", "w1", "n2", "w12"],
      ["w14"],
    ]);
  });

  it("does not crash on a cycle (A inside B, B inside A): both stay stops of their own", () => {
    const a = at("way/20", "A", 55.752, 37.6175, { wikidataId: "Q20", wikipediaCount: 30, parentId: "Q21" });
    const b = at("way/21", "B", 55.7521, 37.6176, { wikidataId: "Q21", wikipediaCount: 30, parentId: "Q20" });
    const plan = buildItinerary({ ...base, daytime: [a, b, ...OTHERS] });
    expect(stops(plan).some((s) => s.inside?.length)).toBe(false);
    expect(stops(plan).map((s) => s.id)).toEqual(expect.arrayContaining([a.id]));
  });

  it("lists the places inside in the parent's calendar event, not as events of their own", () => {
    const plan = buildItinerary(base);
    const ics = buildIcs(plan, { cityName: "Moskova", now: new Date("2026-10-17T09:00:00Z") });
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).not.toMatch(/SUMMARY:Çar Çanı/);
    expect(unfolded).toMatch(/SUMMARY:Московский Кремль\r\nLOCATION:[^\r]*\r\nGEO:[^\r]*\r\nDESCRIPTION:[^\r]*İçinde: Çar Çanı\\, Çar Topu\\, Silah Dairesi/);
    expect(unfolded.match(/BEGIN:VEVENT/g)?.length).toBe(stops(plan).length);
  });
});
