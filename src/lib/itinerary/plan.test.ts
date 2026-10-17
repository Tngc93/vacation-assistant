import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { ITINERARY } from "./config";
import { shortId } from "./ids";
import { sameNameOnce } from "@/lib/places/twins";
import { buildItinerary, chooseAnchors, freeTimeBlock, type ItineraryInput, type PlanPlace } from "./plan";
import { EVENING, SIGHTS } from "./testCity";
import { toMinutes } from "./time";

// Sat 14 → Wed 18 Nov 2026: 4 nights, 5 days.
const base: ItineraryInput = {
  depart: "2026-11-14",
  return: "2026-11-18",
  timeZone: "Europe/Madrid",
  flight: null,
  daytime: SIGHTS,
  evening: EVENING,
  skip: [],
};
const allStops = (plan: ReturnType<typeof buildItinerary>) => plan.days.flatMap((d) => d.stops);
const shuffle = <T,>(list: T[]) => [...list].reverse().sort((a, b) => (JSON.stringify(a).length % 3) - (JSON.stringify(b).length % 3));

describe("buildItinerary", () => {
  it("is deterministic: the same input (in any order) gives the same plan", () => {
    const a = buildItinerary(base);
    expect(buildItinerary(base)).toEqual(a);
    expect(buildItinerary({ ...base, daytime: shuffle(SIGHTS).reverse() })).toEqual(
      buildItinerary({ ...base, daytime: shuffle(SIGHTS).reverse() }),
    );
    // Order of input only matters through the stored rank, never through randomness.
    expect(JSON.stringify(buildItinerary(base))).toBe(JSON.stringify(a));
  });

  it("never uses a place twice", () => {
    const ids = allStops(buildItinerary(base)).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const doubled = buildItinerary({ ...base, daytime: [...SIGHTS, ...SIGHTS], evening: [...EVENING, ...EVENING] });
    const again = allStops(doubled).map((s) => s.id);
    expect(new Set(again).size).toBe(again.length);
  });

  it("treats one place mapped as several OSM objects as one, and a removed twin never comes back", () => {
    // La Rambla is nine ways in OSM.
    const twins = [0, 1, 2].map((i) => ({ ...SIGHTS[0], id: `way/${7000 + i}`, name: "La Rambla", lat: SIGHTS[0].lat + i * 0.001, wikipediaCount: 200 - i }));
    const plan = buildItinerary({ ...base, daytime: [...twins, ...SIGHTS] });
    expect(allStops(plan).filter((s) => s.name === "La Rambla")).toHaveLength(1);
    const kept = allStops(plan).find((s) => s.name === "La Rambla")!;
    expect(kept.id).toBe("way/7000");
    const without = buildItinerary({ ...base, daytime: [...twins, ...SIGHTS], skip: [kept.shortId] });
    expect(allStops(without).some((s) => s.name === "La Rambla")).toBe(false);
    // Same name far apart: two different places.
    const far = { ...twins[1], lat: SIGHTS[0].lat + 0.05 };
    expect(sameNameOnce([twins[0], far])).toHaveLength(2);
  });

  it("suggests a chain's name as an evening place only once, without merging its branches", () => {
    // Three branches of one chain, each the best-ranked place near one area (like Espresso House in Stockholm).
    const chain = [0, 1, 2].map((a) => ({ ...EVENING[a * 2], id: `way/${900 + a}`, name: "Espresso House", detailed: true as const }));
    const plan = buildItinerary({ ...base, evening: [...chain, ...EVENING] });
    const evenings = allStops(plan).filter((s) => s.kind === "evening");
    expect(evenings.filter((s) => s.name === "Espresso House")).toHaveLength(1);
    expect(new Set(evenings.map((s) => s.name)).size).toBe(evenings.length);
    // The branches stay separate places in the data: removing the chosen one lets another branch take an evening.
    const chosen = evenings.find((s) => s.name === "Espresso House")!;
    const without = buildItinerary({ ...base, evening: [...chain, ...EVENING], skip: [chosen.shortId] });
    const again = allStops(without).filter((s) => s.name === "Espresso House");
    expect(again).toHaveLength(1);
    expect(again[0].id).not.toBe(chosen.id);
  });

  it("uses the shared twin rule for sights (places/twins.ts)", () => {
    const twins = [0, 1].map((i) => ({ ...SIGHTS[0], id: `way/${7100 + i}`, name: "La Rambla", wikipediaCount: 300 - i }));
    const expected = sameNameOnce(twins).map((p) => p.id);
    expect(allStops(buildItinerary({ ...base, daytime: [...twins, ...SIGHTS] })).filter((s) => s.name === "La Rambla").map((s) => s.id)).toEqual(expected);
  });

  it("has days = nights + 1 and fills each day by time: at most 6 daytime stops until 18:00, then 1 evening place", () => {
    const plan = buildItinerary(base);
    expect(plan.days.map((d) => d.date)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    for (const day of plan.days) {
      const daytime = day.stops.filter((s) => s.kind === "daytime");
      expect(daytime.length).toBeLessThanOrEqual(ITINERARY.maxDaytimeStops);
      expect(day.stops.filter((s) => s.kind === "evening").length).toBeLessThanOrEqual(1);
      let clock = 0;
      for (const s of day.stops) {
        expect(toMinutes(s.start)).toBeGreaterThanOrEqual(clock);
        clock = toMinutes(s.end);
      }
      for (const s of daytime) expect(toMinutes(s.end)).toBeLessThanOrEqual(ITINERARY.daytimeEnd);
    }
    const full = plan.days[1];
    expect(full.tags).toEqual(["TAM GÜN"]);
    expect(full.window).toEqual({ start: "09:00", end: "21:30" });
    // More than the old fixed four: the day is filled by time.
    expect(full.stops.filter((s) => s.kind === "daytime").length).toBeGreaterThan(4);
    expect(full.stops.at(-1)).toMatchObject({ kind: "evening", start: "19:30", end: "21:30" });
  });

  it("never puts more than 6 daytime stops in a day, even when more would fit", () => {
    // 20 viewpoints of 30 minutes, side by side: time for far more than six.
    const views: PlanPlace[] = Array.from({ length: 20 }, (_, i) => ({
      id: `node/${5000 + i}`,
      name: `View ${i}`,
      lat: 41.39 + i * 0.0002,
      lon: 2.17,
      category: "viewpoint",
      wikipediaCount: 100 - i,
    }));
    const plan = buildItinerary({ ...base, daytime: views, evening: [] });
    const full = plan.days[1].stops;
    expect(full).toHaveLength(6);
    expect(toMinutes(full.at(-1)!.end)).toBeLessThan(ITINERARY.daytimeEnd - 120);
  });

  it("shows free time before the evening place only when the gap is longer than 90 minutes", () => {
    expect(freeTimeBlock(toMinutes("17:55"), toMinutes("19:25"))).toBeNull(); // exactly 90
    expect(freeTimeBlock(toMinutes("17:50"), toMinutes("19:25"))).toEqual({ start: "17:50", end: "19:25" });
    // One short sight on a full day: the afternoon is free, not filled with made-up stops.
    const plan = buildItinerary({ ...base, daytime: [SIGHTS[2]] });
    const day = plan.days.find((d) => d.stops.some((s) => s.kind === "daytime"))!;
    expect(day.stops.map((s) => s.kind)).toEqual(["daytime", "evening"]);
    expect(day.free?.start).toBe(day.stops[0].end);
    expect(toMinutes(day.free!.end)).toBe(toMinutes(day.stops[1].start) - day.stops[1].travel!.scheduledMin);
    // A full day that ends near 18:00 has no free block.
    const busy = buildItinerary(base).days.find((d) => {
      const last = d.stops.filter((s) => s.kind === "daytime").at(-1);
      return last && toMinutes(last.end) >= toMinutes("17:45");
    });
    if (busy) expect(busy.free).toBeNull();
  });
  it("makes the first and last day half days when no flight is chosen, and says it is an assumption", () => {
    const plan = buildItinerary(base);
    expect(plan.basis).toBe("assumed");
    const [first, last] = [plan.days[0], plan.days.at(-1)!];
    expect(first.tags).toEqual(["VARIŞ GÜNÜ", "YARIM GÜN"]);
    expect(first.window).toEqual({ start: "13:00", end: "21:30" });
    const firstDaytime = first.stops.filter((s) => s.kind === "daytime");
    expect(firstDaytime.length).toBeGreaterThan(0);
    expect(firstDaytime.every((s) => s.start >= "13:00" && s.end <= "18:00")).toBe(true);
    expect(first.stops.at(-1)?.kind).toBe("evening");
    expect(last.tags).toEqual(["DÖNÜŞ GÜNÜ", "YARIM GÜN"]);
    expect(last.window).toEqual({ start: "09:00", end: "13:00" });
    expect(last.stops.length).toBeGreaterThan(0);
    expect(last.stops.every((s) => s.end <= "13:00" && s.kind === "daytime")).toBe(true);
    expect([first.flightNote, last.flightNote]).toEqual([false, false]);
  });
  it("starts 2 hours after landing and ends 3.5 hours before the return flight", () => {
    const plan = buildItinerary({
      ...base,
      flight: { arrive: { date: "2026-11-14", time: "10:45" }, leave: { date: "2026-11-18", time: "18:00" }, label: "PC 438" },
    });
    expect(plan.basis).toBe("flight");
    expect(plan.days[0].window?.start).toBe("12:45");
    expect(plan.days.at(-1)?.window?.end).toBe("14:30");
    expect(plan.days.at(-1)?.stops.every((s) => s.end <= "14:30")).toBe(true);
    // A landing after midnight counts on the next local date.
    const nextDay = buildItinerary({ ...base, flight: { arrive: { date: "2026-11-15", time: "01:30" }, leave: null, label: "Y" } });
    expect(nextDay.days[0].stops).toEqual([]);
    expect(nextDay.days[1].window?.start).toBe("09:00");
  });

  it("explains a first or last day the flight leaves without daytime stops, and still has dinner when there is time", () => {
    // Lands 19:30: settle in, dinner at 21:30 (the latest evening start) where a place is open that late.
    const lateKitchens = EVENING.map((p) => ({ ...p, openingHours: "Mo-Su 12:00-01:00" }));
    const evening = buildItinerary({
      ...base,
      evening: lateKitchens,
      flight: { arrive: { date: "2026-11-14", time: "19:30" }, leave: { date: "2026-11-18", time: "06:55" }, label: "PC 438" },
    });
    expect(evening.days[0]).toMatchObject({
      note: "Bu uçuşla varış 19:30'da; ilk gün yalnızca yerleşme ve akşam yemeği.",
      flightNote: true,
      window: { start: "21:30", end: "23:30" },
    });
    expect(evening.days[0].stops.map((s) => [s.kind, s.start])).toEqual([["evening", "21:30"]]);
    expect(evening.days.at(-1)).toMatchObject({
      note: "Bu uçuşla dönüş kalkışı 06:55'te; son gün havalimanına geçiş için.",
      flightNote: true,
      stops: [],
      window: null,
    });
    // Kitchens closing at 23:00 cannot host a 21:30–23:30 dinner: the plan says settling in only.
    const early = buildItinerary({
      ...base,
      flight: { arrive: { date: "2026-11-14", time: "19:30" }, leave: { date: "2026-11-18", time: "06:55" }, label: "PC 438" },
    });
    expect(early.days[0]).toMatchObject({ note: "Bu uçuşla varış 19:30'da; ilk gün yalnızca yerleşme.", stops: [] });
    // Lands 23:10: no time for dinner either.
    const late = buildItinerary({
      ...base,
      flight: { arrive: { date: "2026-11-14", time: "23:10" }, leave: { date: "2026-11-18", time: "18:00" }, label: "X" },
    });
    expect(late.days[0]).toMatchObject({ note: "Bu uçuşla varış 23:10'da; ilk gün yalnızca yerleşme.", flightNote: true, stops: [], window: null });
    expect(late.days.at(-1)?.flightNote).toBe(false);
  });
  it("starts each full day in a different area, with its most important place", () => {
    const plan = buildItinerary(base);
    const firsts = plan.days.filter((d) => d.tags.includes("TAM GÜN")).map((d) => d.stops[0]);
    expect(firsts.map((s) => s.name)).toEqual(["Sight 0-0", "Sight 1-0", "Sight 2-0"]);
    for (let i = 0; i < firsts.length; i++)
      for (let j = i + 1; j < firsts.length; j++)
        expect(distanceKm(firsts[i].lat, firsts[i].lon, firsts[j].lat, firsts[j].lon)).toBeGreaterThanOrEqual(ITINERARY.anchorMinKm);
  });

  it("orders a day by nearest neighbour and estimates the walk", () => {
    const day = buildItinerary(base).days[1];
    const [a, b] = day.stops;
    expect(b.travel).toMatchObject({ transit: false });
    const km = distanceKm(a.lat, a.lon, b.lat, b.lon);
    expect(b.travel!.km).toBeCloseTo(km, 6);
    expect(b.travel!.walkMin).toBe(Math.max(5, Math.ceil(((km * 1.3) / 4.5) * 60 / 5) * 5));
    expect(day.stops[0].travel).toBeNull();
  });

  it("skips a place surely closed at that time, and flags unknown hours", () => {
    // The top sight only opens 15:00–18:00: it cannot be the 09:00 stop of a full day.
    const lateOpener = { ...SIGHTS[0], openingHours: "Mo-Su 15:00-18:00" };
    const plan = buildItinerary({ ...base, daytime: [lateOpener, ...SIGHTS.slice(1)] });
    for (const s of allStops(plan).filter((s) => s.id === lateOpener.id)) {
      expect(s.start >= "15:00" && s.end <= "18:00").toBe(true);
      expect(s.hours).toBe("open");
    }
    // Open only on Tuesdays (the trip has a Tuesday, 17 Nov): never on another day.
    const tuesday = { ...SIGHTS[1], openingHours: "Tu 09:00-18:00" };
    const tue = buildItinerary({ ...base, daytime: [tuesday, ...SIGHTS.filter((s) => s.id !== tuesday.id)] });
    const placed = tue.days.find((d) => d.stops.some((s) => s.id === tuesday.id));
    if (placed) expect(placed.date).toBe("2026-11-17");
    // Open on no day of the trip: left out.
    const never = { ...SIGHTS[2], openingHours: "Th 09:00-18:00" };
    expect(allStops(buildItinerary({ ...base, daytime: [never, ...SIGHTS.filter((s) => s.id !== never.id)] })).some((s) => s.id === never.id)).toBe(false);
    // No hours at all: allowed, with "check the hours".
    expect(allStops(plan).filter((s) => s.kind === "daytime").every((s) => s.hours === "unknown" || s.id === lateOpener.id)).toBe(true);
    expect(allStops(plan).filter((s) => s.kind === "evening").every((s) => s.hours === "open")).toBe(true);
  });

  it("reads weekdays from the destination's local date", () => {
    // Sunday 15 Nov 2026 is the only Sunday of the trip.
    const sundayOnly = { ...SIGHTS[0], openingHours: "Su 09:00-18:00" };
    const plan = buildItinerary({ ...base, daytime: [sundayOnly, ...SIGHTS.slice(1)] });
    const day = plan.days.find((d) => d.stops.some((s) => s.id === sundayOnly.id));
    expect(day?.date).toBe("2026-11-15");
  });

  it("suggests public transport over 3 km and schedules 30 minutes for it", () => {
    const far: PlanPlace = { ...SIGHTS[3], id: "node/999", lat: SIGHTS[0].lat + 0.05, wikipediaCount: 1 };
    const plan = buildItinerary({ ...base, daytime: [SIGHTS[0], far], evening: [] });
    const legs = allStops(plan).filter((s) => s.travel?.transit);
    for (const s of legs) {
      expect(s.travel!.km).toBeGreaterThan(3);
      expect(s.travel!.scheduledMin).toBe(30);
    }
  });

  it("rebuilds without removed places: the next candidate takes the slot, and the same skip gives the same plan", () => {
    const plan = buildItinerary(base);
    const removed = plan.days[1].stops[1];
    const skip = [removed.shortId];
    const next = buildItinerary({ ...base, skip });
    expect(allStops(next).some((s) => s.id === removed.id)).toBe(false);
    const daytimeCount = (p: typeof plan) => p.days[1].stops.filter((s) => s.kind === "daytime").length;
    expect(daytimeCount(next)).toBe(daytimeCount(plan));
    expect(next.skipped).toEqual(skip);
    expect(buildItinerary({ ...base, skip })).toEqual(next);
    // Unknown ids are ignored.
    expect(buildItinerary({ ...base, skip: ["n42424242"] }).skipped).toEqual([]);
    // Removing an evening place brings in another one.
    const evening = plan.days[1].stops.at(-1)!;
    const swapped = buildItinerary({ ...base, skip: [evening.shortId] });
    expect(swapped.days[1].stops.at(-1)).toMatchObject({ kind: "evening" });
    expect(swapped.days[1].stops.at(-1)?.id).not.toBe(evening.id);
  });
  it("has no evening place when the evening list is empty, and fewer stops when the city has few", () => {
    const plan = buildItinerary({ ...base, daytime: SIGHTS.slice(0, 3), evening: [] });
    expect(allStops(plan)).toHaveLength(3);
    expect(allStops(plan).every((s) => s.kind === "daytime")).toBe(true);
    expect(buildItinerary({ ...base, daytime: [], evening: [] }).days.every((d) => d.stops.length === 0)).toBe(true);
  });

  it("links each stop to OpenStreetMap with a short id", () => {
    const stop = allStops(buildItinerary(base))[0];
    expect(stop.shortId).toBe(shortId(stop.id));
    expect(stop.osmUrl).toBe(`https://www.openstreetmap.org/${stop.id}`);
  });
});

describe("chooseAnchors", () => {
  it("takes the most important places that are far enough apart, relaxing the distance when needed", () => {
    expect(chooseAnchors(SIGHTS, 3).map((p) => p.name)).toEqual(["Sight 0-0", "Sight 1-0", "Sight 2-0"]);
    // Only one area: the distance halves until there are enough anchors.
    expect(chooseAnchors(SIGHTS.slice(0, 6), 3)).toHaveLength(3);
    expect(chooseAnchors(SIGHTS.slice(0, 2), 5)).toHaveLength(2);
    expect(chooseAnchors(SIGHTS, 0)).toEqual([]);
  });
});
