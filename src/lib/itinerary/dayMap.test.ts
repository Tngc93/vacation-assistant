import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_DAY_DEBOUNCE_MS, activeDayAt, createActiveDayTracker, numberedStops, stopAnchorId } from "./dayMap";
import { buildItinerary, type PlanPlace } from "./plan";

describe("activeDayAt", () => {
  const vh = 1000; // the line sits at 400 px
  const at = (...tops: number[]) => tops.map((top, i) => ({ day: i + 1, top }));

  it("is the first day before any heading has crossed the line", () => {
    expect(activeDayAt(at(900, 1800, 2700), vh)).toBe(1);
    expect(activeDayAt(at(401, 1300), vh)).toBe(1);
  });

  it("is the last day whose heading has crossed the top 40% of the viewport", () => {
    expect(activeDayAt(at(400, 1300), vh)).toBe(1);
    expect(activeDayAt(at(-500, 399, 1300), vh)).toBe(2);
    expect(activeDayAt(at(-2000, -1100, -200, 700), vh)).toBe(3);
    // Every heading scrolled past: the last day.
    expect(activeDayAt(at(-3000, -2000, -1000), vh)).toBe(3);
  });

  it("goes back with the scroll", () => {
    expect(activeDayAt(at(-600, 300), vh)).toBe(2);
    expect(activeDayAt(at(-100, 800), vh)).toBe(1);
  });

  it("uses the days it is given (days without stops are left out by the caller) and another line if asked", () => {
    expect(activeDayAt([{ day: 2, top: -10 }, { day: 4, top: 300 }], vh)).toBe(4);
    expect(activeDayAt([{ day: 2, top: -10 }, { day: 4, top: 300 }], vh, 0.2)).toBe(2);
    expect(activeDayAt([], vh)).toBeNull();
  });
});

describe("createActiveDayTracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports a new day only after the scroll has settled", () => {
    const onChange = vi.fn();
    const tracker = createActiveDayTracker({ onChange });
    tracker.update(1);
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("does not flick through the days of a fast scroll", () => {
    const onChange = vi.fn();
    const tracker = createActiveDayTracker({ onChange });
    tracker.update(1);
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS);
    for (const day of [2, 3, 4]) {
      tracker.update(day);
      vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS / 3);
    }
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS);
    expect(onChange.mock.calls).toEqual([[1], [4]]);
  });

  it("stays quiet when the day comes back before the delay, or does not change", () => {
    const onChange = vi.fn();
    const tracker = createActiveDayTracker({ onChange });
    tracker.update(1);
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS);
    tracker.update(2);
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS / 2);
    tracker.update(1);
    tracker.update(1);
    tracker.update(null);
    vi.advanceTimersByTime(ACTIVE_DAY_DEBOUNCE_MS * 2);
    expect(onChange.mock.calls).toEqual([[1]]);
  });

  it("keeps a forced day until the measured day really changes, then follows again", () => {
    const onChange = vi.fn();
    const tracker = createActiveDayTracker({ delayMs: 100, onChange });
    tracker.update(2);
    vi.advanceTimersByTime(100);
    // "Haritada göster" on day 4: a pending change is dropped, and day 2 measured again is no change.
    tracker.update(3);
    tracker.cancel();
    vi.advanceTimersByTime(100);
    tracker.update(2);
    vi.advanceTimersByTime(100);
    expect(onChange.mock.calls).toEqual([[2]]);
    tracker.update(3);
    vi.advanceTimersByTime(100);
    expect(onChange.mock.calls).toEqual([[2], [3]]);
  });
});

describe("numberedStops", () => {
  // Moscow, Sat 14 → Tue 17 Nov 2026: the Tsar Bell and the Tsar Cannon inside the Kremlin.
  const at = (id: string, name: string, lat: number, lon: number, extra: Partial<PlanPlace> = {}): PlanPlace => ({ id, name, lat, lon, category: "see", ...extra });
  const inKremlin = { parentId: "Q1", parentName: "Moskova Kremlini" };
  const plan = buildItinerary({
    depart: "2026-11-14",
    return: "2026-11-17",
    timeZone: "Europe/Moscow",
    flight: null,
    daytime: [
      at("way/1", "Московский Кремль", 55.752, 37.6175, { wikidataId: "Q1", wikipediaCount: 91 }),
      at("node/2", "Çar Çanı", 55.7511, 37.6176, { wikidataId: "Q2", wikipediaCount: 42, ...inKremlin }),
      at("node/3", "Çar Topu", 55.7519, 37.6177, { wikidataId: "Q3", wikipediaCount: 42, ...inKremlin }),
      at("way/10", "Kızıl Meydan", 55.7539, 37.6208, { wikidataId: "Q10", wikipediaCount: 98, walkThrough: true }),
      at("way/11", "Aziz Vasil Katedrali", 55.7525, 37.6231, { wikidataId: "Q11", wikipediaCount: 76 }),
      at("way/12", "Bolşoy Tiyatrosu", 55.7601, 37.6186, { wikidataId: "Q12", wikipediaCount: 60 }),
    ],
    evening: [],
    skip: [],
  });

  it("numbers a day's stops 1, 2, 3… in the list's order; places inside a stop share its number", () => {
    const day = plan.days.find((d) => d.stops.some((s) => s.inside?.length))!;
    const numbered = numberedStops(day);
    expect(numbered.map((n) => n.number)).toEqual(day.stops.map((_, i) => i + 1));
    expect(numbered.map((n) => n.stop.id)).toEqual(day.stops.map((s) => s.id));
    // The Tsar Bell and the Tsar Cannon are no markers of their own.
    const ids = numbered.map((n) => n.stop.id);
    expect(ids).not.toContain("node/2");
    expect(ids).not.toContain("node/3");
    expect(numbered.find((n) => n.stop.id === "way/1")?.stop.inside?.map((s) => s.id)).toEqual(["node/2", "node/3"]);
  });

  it("anchors a stop by its day and number", () => {
    expect(stopAnchorId(2, 3)).toBe("gun-2-durak-3");
  });
});
