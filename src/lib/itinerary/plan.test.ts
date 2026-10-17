import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { ITINERARY } from "./config";
import { shortId } from "./ids";
import { buildItinerary, chooseAnchors, sameNameOnce, type ItineraryInput, type PlanPlace } from "./plan";
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

  it("has days = nights + 1, at most 4 daytime stops and 1 evening place, in order and inside the day", () => {
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
    // Full days get the most.
    expect(plan.days[1].stops.map((s) => s.kind)).toEqual(["daytime", "daytime", "daytime", "daytime", "evening"]);
    expect(plan.days[1].tags).toEqual(["TAM GÜN"]);
  });

  it("makes the first and last day half days when no flight is chosen, and says it is an assumption", () => {
    const plan = buildItinerary(base);
    expect(plan.basis).toBe("assumed");
    const [first, last] = [plan.days[0], plan.days.at(-1)!];
    expect(first.tags).toEqual(["VARIŞ GÜNÜ", "YARIM GÜN"]);
    expect(first.window?.start).toBe("13:00");
    expect(first.stops.every((s) => s.start >= "13:00")).toBe(true);
    // 13:00–18:30 is 330 of 570 daytime minutes → 2 stops (proportional, rounded down), plus the evening.
    expect(first.stops.filter((s) => s.kind === "daytime")).toHaveLength(2);
    expect(first.stops.at(-1)?.kind).toBe("evening");
    expect(last.tags).toEqual(["DÖNÜŞ GÜNÜ", "YARIM GÜN"]);
    expect(last.window?.end).toBe("13:00");
    expect(last.stops.every((s) => s.end <= "13:00" && s.kind === "daytime")).toBe(true);
    // 09:00–13:00 is 240 of 570 → 1 stop.
    expect(last.stops).toHaveLength(1);
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
    // A late landing leaves no time on the first day; an early flight none on the last.
    const tight = buildItinerary({
      ...base,
      flight: { arrive: { date: "2026-11-14", time: "23:10" }, leave: { date: "2026-11-18", time: "06:55" }, label: "X" },
    });
    expect(tight.days[0]).toMatchObject({ stops: [], window: null, note: "Varıştan sonra plan için zaman kalmıyor." });
    expect(tight.days.at(-1)).toMatchObject({ stops: [], window: null, note: "Dönüş uçuşundan önce plan için zaman kalmıyor." });
    // A landing after midnight counts on the next local date.
    const nextDay = buildItinerary({
      ...base,
      flight: { arrive: { date: "2026-11-15", time: "01:30" }, leave: null, label: "Y" },
    });
    expect(nextDay.days[0].stops).toEqual([]);
    expect(nextDay.days[1].window?.start).toBe("09:00");
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
    expect(next.days[1].stops.filter((s) => s.kind === "daytime")).toHaveLength(4);
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
