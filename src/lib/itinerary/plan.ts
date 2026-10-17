import { distanceKm } from "@/lib/geo";
import type { CategoryId } from "@/lib/places/categories";
import { nameKey, sameNameOnce } from "@/lib/places/twins";
import { addDays, daysBetween } from "@/lib/search/dates";
import { DAYTIME_CATEGORIES, ITINERARY, type DaytimeCategory } from "./config";
import { shortId } from "./ids";
import { openVerdict } from "./openCheck";
import { withLocative } from "@/lib/places/hours";
import { hhmm, roundDown, roundUp, toMinutes, weekdayOf } from "./time";
import { travelBetween, type Travel } from "./travel";

/** A place the plan may use (from the pre-fetched city file). */
export type PlanPlace = {
  id: string;
  name: string;
  localName?: string;
  lat: number;
  lon: number;
  address?: string;
  openingHours?: string;
  wikipediaCount?: number;
  detailed?: true;
  category: CategoryId;
};

/** Local date and time in the destination's time zone. */
export type LocalMoment = { date: string; time: string };

export type ItineraryInput = {
  /** Trip dates (YYYY-MM-DD); days = nights + 1. */
  depart: string;
  return: string;
  timeZone: string;
  /** The budget's flight, in destination local time; null when there is none. */
  flight: { arrive: LocalMoment | null; leave: LocalMoment | null; label: string } | null;
  /** Daytime candidates (see, museum, viewpoint), each list in its stored rank order. */
  daytime: PlanPlace[];
  /** Evening candidates from the chosen evening categories, each list in its stored rank order. */
  evening: PlanPlace[];
  /** Short ids the user removed. */
  skip: readonly string[];
};

export type PlanStop = {
  id: string;
  shortId: string;
  name: string;
  localName?: string;
  category: CategoryId;
  kind: "daytime" | "evening";
  lat: number;
  lon: number;
  address?: string;
  start: string;
  end: string;
  durationMin: number;
  /** "unknown": no readable opening hours, so the card says to check them. */
  hours: "open" | "unknown";
  /** From the previous stop of the day; null for the first. */
  travel: Travel | null;
  osmUrl: string;
};

export type DayTag = "VARIŞ GÜNÜ" | "DÖNÜŞ GÜNÜ" | "YARIM GÜN" | "TAM GÜN";

export type PlanDay = {
  number: number;
  date: string;
  tags: DayTag[];
  /** When the day's plan may start and must end (local), null when no time is left that day. */
  window: { start: string; end: string } | null;
  stops: PlanStop[];
  /** Unplanned time between the last daytime stop and the evening place, when longer than 90 minutes. */
  free: { start: string; end: string } | null;
  /** Why a day has fewer or no stops. */
  note: string | null;
  /** True when the note is about the flight's times: the page links to the flights section. */
  flightNote: boolean;
};

export type Itinerary = {
  days: PlanDay[];
  /** "flight": first and last day follow the chosen flight; "assumed": half days, no flight chosen. */
  basis: "flight" | "assumed";
  timeZone: string;
  /** Short ids actually skipped (present in the data). */
  skipped: string[];
};


function visitMinutes(p: PlanPlace, kind: "daytime" | "evening"): number {
  if (kind === "evening") return ITINERARY.visitMin.evening;
  return ITINERARY.visitMin[p.category as DaytimeCategory] ?? ITINERARY.visitMin.see;
}

/** Total order: Wikipedia language count, then category, then stored rank, then id. */
function importanceOrder(places: PlanPlace[]): PlanPlace[] {
  const rank = new Map(places.map((p, i) => [p.id, i]));
  const catIndex = (c: CategoryId) => DAYTIME_CATEGORIES.indexOf(c as DaytimeCategory);
  return [...places].sort(
    (a, b) =>
      (b.wikipediaCount ?? 0) - (a.wikipediaCount ?? 0) ||
      catIndex(a.category) - catIndex(b.category) ||
      rank.get(a.id)! - rank.get(b.id)! ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

const byId = (a: PlanPlace, b: PlanPlace) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceKm(a.lat, a.lon, b.lat, b.lon);

/**
 * The most important places at least 1.2 km apart. When the city has fewer
 * such areas than days, the distance halves and more anchors are added, but
 * the ones already found keep their place, so the longest days still start in
 * clearly different areas.
 */
export function chooseAnchors(ordered: PlanPlace[], count: number): PlanPlace[] {
  const target = Math.min(count, ordered.length);
  const anchors: PlanPlace[] = [];
  for (let minKm: number = ITINERARY.anchorMinKm; anchors.length < target && minKm >= 0.01; minKm /= 2) {
    for (const p of ordered) {
      if (anchors.length === target) break;
      if (!anchors.includes(p) && anchors.every((a) => dist(a, p) >= minKm)) anchors.push(p);
    }
  }
  // Places on top of each other: fill up in importance order.
  for (const p of ordered) if (anchors.length < target && !anchors.includes(p)) anchors.push(p);
  return anchors;
}

/** Absolute minutes from the first trip day's midnight. */
function absolute(depart: string, moment: LocalMoment): number {
  return daysBetween(depart, moment.date) * 1440 + toMinutes(moment.time);
}

type DayFrame = {
  number: number;
  date: string;
  tags: DayTag[];
  /** Absolute minutes; null when no daytime visit fits. */
  daytime: { start: number; end: number } | null;
  /** Absolute start of the evening place; null when there is no time for it. */
  evening: number | null;
};

const SHORTEST_VISIT = Math.min(ITINERARY.visitMin.see, ITINERARY.visitMin.museum, ITINERARY.visitMin.viewpoint);

function frames(input: ItineraryInput): DayFrame[] {
  const count = daysBetween(input.depart, input.return) + 1;
  const flight = input.flight;
  const last = (count - 1) * 1440;
  const ready = flight?.arrive ? absolute(input.depart, flight.arrive) + ITINERARY.arrivalBufferMin : ITINERARY.halfDaySplit;
  const deadline = flight?.leave ? absolute(input.depart, flight.leave) - ITINERARY.departureBufferMin : last + ITINERARY.halfDaySplit;

  return Array.from({ length: count }, (_, i) => {
    const base = i * 1440;
    const start = Math.max(base + ITINERARY.dayStart, roundUp(ready));
    const end = Math.min(base + ITINERARY.daytimeEnd, roundDown(deadline));
    const daytime = end - start >= SHORTEST_VISIT ? { start, end } : null;
    // Dinner at 19:30, or after settling in on a late arrival, as long as it starts by 21:30 and ends before the return.
    const eveningAt = Math.max(base + ITINERARY.eveningStart, roundUp(ready));
    const evening =
      eveningAt <= base + ITINERARY.eveningLatestStart && eveningAt + ITINERARY.visitMin.evening <= deadline ? eveningAt : null;
    const full = daytime?.start === base + ITINERARY.dayStart && daytime.end === base + ITINERARY.daytimeEnd && evening !== null;
    const tags: DayTag[] = [];
    if (i === 0) tags.push("VARIŞ GÜNÜ");
    if (i === count - 1) tags.push("DÖNÜŞ GÜNÜ");
    tags.push(full ? "TAM GÜN" : "YARIM GÜN");
    return { number: i + 1, date: addDays(input.depart, i), tags, daytime, evening };
  });
}

/** Free time between two moments (minutes past midnight), shown only when longer than 90 minutes. */
export function freeTimeBlock(from: number, to: number): { start: string; end: string } | null {
  return to - from > ITINERARY.freeTimeMin ? { start: hhmm(from), end: hhmm(to) } : null;
}

/** The calm note for a first or last day the flight leaves without daytime stops. */
function flightDayNote(first: boolean, flight: NonNullable<ItineraryInput["flight"]>, withEvening: boolean): string | null {
  if (first && flight.arrive) {
    return `Bu uçuşla varış ${withLocative(flight.arrive.time)}; ilk gün yalnızca yerleşme${withEvening ? " ve akşam yemeği" : ""}.`;
  }
  if (!first && flight.leave) {
    return `Bu uçuşla dönüş kalkışı ${withLocative(flight.leave.time)}; son gün ${withEvening ? "akşam yemeği ve " : ""}havalimanına geçiş için.`;
  }
  return null;
}

function toStop(p: PlanPlace, kind: "daytime" | "evening", start: number, travel: Travel | null, hours: "open" | "unknown"): PlanStop {
  const durationMin = visitMinutes(p, kind);
  return {
    id: p.id,
    shortId: shortId(p.id),
    name: p.name,
    ...(p.localName ? { localName: p.localName } : {}),
    category: p.category,
    kind,
    lat: p.lat,
    lon: p.lon,
    ...(p.address ? { address: p.address } : {}),
    start: hhmm(start),
    end: hhmm(start + durationMin),
    durationMin,
    hours,
    travel,
    osmUrl: `https://www.openstreetmap.org/${p.id}`,
  };
}

/**
 * The deterministic day-by-day plan (PRD 20). Same input, same plan: every
 * sort is a total order and nothing is random.
 *
 * 1. Each day gets a time window: full days 09:00–18:00 plus an evening
 *    place at 19:30; the first and last follow the flight (2 h after landing,
 *    3.5 h before the return; dinner may move to 21:30 after a late landing),
 *    or are half days split at 13:00 when no flight is chosen.
 * 2. One anchor per day with daytime capacity: the most important places
 *    (Wikipedia language count) that are at least 1.2 km apart, so each
 *    day's main stop is in a different area. Every place belongs to its
 *    nearest anchor; days with the most time get the most important anchors.
 * 3. Each day starts at its anchor and continues to the nearest unused place
 *    of its area (then any area), skipping places surely closed at that time
 *    and stops that would not fit: the daytime fills by time, up to 6 stops.
 *    A gap over 90 minutes before the evening place is shown as free time,
 *    never filled with made-up stops.
 * 4. The evening place is the best ranked one near the last stop; a chain's
 *    name is suggested only once in the plan.
 */
export function buildItinerary(input: ItineraryInput): Itinerary {
  const skip = new Set(input.skip);
  const allIds = new Set([...input.daytime, ...input.evening].map((p) => shortId(p.id)));
  // Sights mapped as several OSM objects count once (the shared rule in places/twins.ts). Twins are removed
  // before skipping, so removing a place never brings back its twin.
  const daytime = sameNameOnce(importanceOrder(input.daytime)).filter((p) => !skip.has(shortId(p.id)));
  // Food and drink are not merged (the same name nearby is usually another branch of a chain); instead each
  // name is suggested as an evening place at most once in the plan.
  const seenEvening = new Set<string>();
  const evening = input.evening.filter((p) => !seenEvening.has(p.id) && seenEvening.add(p.id) && !skip.has(shortId(p.id)));
  const eveningNames = new Set<string>();
  const eveningRank = new Map(evening.map((p, i) => [p.id, (p.detailed ? 0 : 1) * 100_000 + i]));

  const days = frames(input);
  const used = new Set<string>();
  const planned = new Map<number, PlanStop[]>(days.map((d) => [d.number, []]));

  // Days with the most daytime come first, then by date: they get the most important anchors.
  const length = (d: DayFrame) => (d.daytime ? d.daytime.end - d.daytime.start : 0);
  const order = days.filter((d) => d.daytime).sort((a, b) => length(b) - length(a) || a.number - b.number);
  const anchors = chooseAnchors(daytime, order.length);
  const areaOf = new Map<string, number>();
  for (const p of daytime) {
    let best = 0;
    anchors.forEach((a, i) => {
      if (dist(p, a) < dist(p, anchors[best]) - 1e-9) best = i;
    });
    areaOf.set(p.id, best);
  }

  order.forEach((day, i) => {
    const window = day.daytime!;
    const weekday = weekdayOf(day.date);
    const base = (day.number - 1) * 1440;
    const anchor = anchors[i];
    const stops: PlanStop[] = [];
    let at: PlanPlace | null = null;
    let clock = window.start;

    // Fill the daytime window by time; never more than six stops.
    while (stops.length < ITINERARY.maxDaytimeStops) {
      const unused = daytime.filter((p) => !used.has(p.id));
      const own = unused.filter((p) => anchor && areaOf.get(p.id) === i);
      const others = unused.filter((p) => !anchor || areaOf.get(p.id) !== i);
      const from: PlanPlace | null = at ?? anchor ?? null;
      const near = (list: PlanPlace[]) =>
        from ? [...list].sort((a, b) => dist(from, a) - dist(from, b) || byId(a, b)) : list;
      // The first stop is the area's most important open place; then nearest neighbour.
      const candidates: PlanPlace[] = at === null ? [...own, ...near(others)] : [...near(own), ...near(others)];

      let chosen: PlanStop | null = null;
      for (const p of candidates) {
        const travel: Travel | null = at ? travelBetween(at, p) : null;
        const start = roundUp(clock + (travel?.scheduledMin ?? 0));
        const end = start + visitMinutes(p, "daytime");
        if (end > window.end) continue;
        const verdict = openVerdict(p.openingHours, weekday, start - base, end - base);
        if (verdict === "closed") continue;
        chosen = toStop(p, "daytime", start - base, travel, verdict);
        used.add(p.id);
        at = p;
        clock = end;
        break;
      }
      if (!chosen) break;
      stops.push(chosen);
    }
    planned.set(day.number, stops);
  });

  // Evening places, in date order, near each day's last stop (or the day's anchor, or the city's first sight).
  for (const day of days) {
    if (day.evening === null) continue;
    const stops = planned.get(day.number)!;
    const lastStop = stops.at(-1);
    const fallback = anchors[order.findIndex((d) => d.number === day.number)] ?? daytime[0] ?? evening[0];
    const ref = lastStop ?? fallback;
    if (!ref) continue;
    const weekday = weekdayOf(day.date);
    const start = day.evening - (day.number - 1) * 1440;
    const end = start + ITINERARY.visitMin.evening;
    const open = evening
      .filter((p) => !used.has(p.id) && !eveningNames.has(nameKey(p)))
      .map((p) => ({ p, verdict: openVerdict(p.openingHours, weekday, start, end), km: dist(ref, p) }))
      .filter((c) => c.verdict !== "closed");
    const close = open.filter((c) => c.km <= ITINERARY.eveningRadiusKm);
    const pick = (close.length
      ? close.sort((a, b) => eveningRank.get(a.p.id)! - eveningRank.get(b.p.id)! || byId(a.p, b.p))
      : open.sort((a, b) => a.km - b.km || byId(a.p, b.p)))[0];
    if (!pick) continue;
    used.add(pick.p.id);
    eveningNames.add(nameKey(pick.p));
    const travel = lastStop ? travelBetween(lastStop, pick.p) : null;
    stops.push(toStop(pick.p, "evening", start, travel, pick.verdict === "open" ? "open" : "unknown"));
  }

  const lastIndex = days.length - 1;
  return {
    days: days.map((d, i) => {
      const base = (d.number - 1) * 1440;
      const stops = planned.get(d.number)!;
      const evening = stops.find((s) => s.kind === "evening") ?? null;
      const window =
        d.daytime || d.evening !== null
          ? {
              start: hhmm(d.daytime ? d.daytime.start - base : d.evening! - base),
              end: hhmm(d.evening !== null ? d.evening - base + ITINERARY.visitMin.evening : d.daytime!.end - base),
            }
          : null;

      // Free time: from the last daytime stop (or the start of an empty daytime) to leaving for the evening place.
      const lastDaytime = stops.filter((s) => s.kind === "daytime").at(-1);
      const freeFrom = lastDaytime ? toMinutes(lastDaytime.end) : d.daytime ? d.daytime.start - base : null;
      const freeTo = evening ? roundDown(toMinutes(evening.start) - (evening.travel?.scheduledMin ?? 0)) : null;
      const free = freeFrom !== null && freeTo !== null ? freeTimeBlock(freeFrom, freeTo) : null;

      const edge = i === 0 || i === lastIndex;
      const flightNote = edge && !d.daytime && input.flight ? flightDayNote(i === 0, input.flight, evening !== null) : null;
      const note =
        flightNote ??
        (!d.daytime && d.evening === null
          ? "Bu gün için plan zamanı kalmıyor."
          : stops.length === 0
            ? "Bu zaman aralığına uyan açık bir mekân bulunamadı."
            : null);
      return { number: d.number, date: d.date, tags: d.tags, window, stops, free, note, flightNote: flightNote !== null };
    }),
    basis: input.flight?.arrive && input.flight?.leave ? "flight" : "assumed",
    timeZone: input.timeZone,
    skipped: input.skip.filter((s) => allIds.has(s)),
  };
}
