import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { DAYTIME_CATEGORIES } from "@/lib/itinerary/config";
import { buildItinerary, chooseMustSees, type ItineraryInput, type PlanPlace } from "@/lib/itinerary/plan";
import type { CategoryId } from "@/lib/places/categories";
import { loadPlacesFile } from "@/lib/places/load";
import { sameNameOnce } from "@/lib/places/twins";

/**
 * The plan on the real stored data, read the way the plan page reads it (rules and overrides applied):
 * a 4-night trip without a chosen flight (half days at both ends).
 */
async function planFor(code: string) {
  const destination = findDestination(code)!;
  const file = (await loadPlacesFile(code))!;
  const take = (ids: readonly CategoryId[]): PlanPlace[] =>
    ids.flatMap((category) => {
      const entry = file.categories[category];
      return entry.status === "ok" ? entry.places.map((p) => ({ ...p, category })) : [];
    });
  const input: ItineraryInput = {
    depart: "2026-11-14",
    return: "2026-11-18",
    timeZone: destination.timeZone,
    flight: null,
    daytime: take(DAYTIME_CATEGORIES),
    evening: take(["restaurant"]),
    skip: [],
  };
  return { input, plan: buildItinerary(input) };
}

/** The trip's five best-known must-sees: by Wikipedia languages, one visit per spot. */
const topFive = (daytime: PlanPlace[]) =>
  chooseMustSees(
    sameNameOnce([...daytime].sort((a, b) => (b.wikipediaCount ?? 0) - (a.wikipediaCount ?? 0) || (a.id < b.id ? -1 : 1))),
    100,
  ).slice(0, 5);

describe.each(["BCN", "PAR", "ROM", "LON", "AMS", "SJJ"])("plan on real data: %s", (code) => {
  it("visits the trip's five best-known places and at most one unnamed viewpoint a day", async () => {
    const { input, plan } = await planFor(code);
    const planned = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.id)));
    for (const p of topFive(input.daytime)) expect(planned.has(p.id), `${p.name} (${p.wikipediaCount})`).toBe(true);
    const byId = new Map(input.daytime.map((p) => [p.id, p]));
    for (const day of plan.days) {
      const unnamed = day.stops.filter((s) => s.category === "viewpoint" && !byId.get(s.id)?.wikidataId);
      expect(unnamed.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("the Bataclan and the Moulin Rouge (place-overrides.ts)", () => {
  it("keeps the Bataclan out of the Paris guide and plan, and shows the Moulin Rouge as a 30-minute stop", async () => {
    const file = (await loadPlacesFile("PAR"))!;
    const guide = Object.values(file.categories).flatMap((e) => (e.status === "ok" ? e.places : []));
    expect(guide.some((p) => p.wikidataId === "Q810700" || /bataclan/i.test(p.name))).toBe(false);
    expect(guide.find((p) => p.wikidataId === "Q151030")).toMatchObject({ visitMin: 30 });

    const { plan } = await planFor("PAR");
    const stops = plan.days.flatMap((d) => d.stops);
    expect(stops.some((s) => /bataclan/i.test(s.name))).toBe(false);
    const moulin = stops.find((s) => s.id === "wikidata/Q151030");
    if (moulin) expect(moulin.durationMin).toBe(30);
  });
});
