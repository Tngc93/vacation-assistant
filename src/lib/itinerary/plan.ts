import { distanceKm } from "@/lib/geo";
import type { CategoryId } from "@/lib/places/categories";
import { nameKey, sameNameOnce } from "@/lib/places/twins";
import { addDays, daysBetween } from "@/lib/search/dates";
import { DAYTIME_CATEGORIES, ITINERARY, type DaytimeCategory } from "./config";
import { shortId } from "./ids";
import { openCheck } from "./openCheck";
import { hhmm, roundDown, roundUp, toMinutes, weekdayOf } from "./time";
import { needsTransit, travelBetween, type Travel } from "./travel";

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
  /** Wikidata item, when the place has one (viewpoints without one are fillers only). */
  wikidataId?: string;
  /** ISO code when the place is in another country (the Vatican from Rome). */
  country?: string;
  /** Streets, squares, bridges: walked through, so never a long visit. */
  walkThrough?: true;
  /** Visit length set by a hand-kept override (the Moulin Rouge, seen from outside). */
  visitMin?: number;
  /** A residence closed to visitors (the Élysée): never a plan stop. */
  noVisit?: true;
  /** Seen from outside only, except in `openMonths` (Buckingham Palace's State Rooms open July–September). */
  exterior?: { visitMin?: number; openMonths?: readonly number[]; note?: string };
  /**
   * Far from the centre (places/far.ts), in km: its far area (`farAreas`) gets one day, and a day goes to at most
   * one far area; never a filler of a day that goes elsewhere.
   */
  farKm?: number;
  /** Wikidata item of the place it is inside (the Tsar Bell in the Kremlin): visited with that place, as a sub-stop. */
  parentId?: string;
  /** That place's name to show: "Moskova Kremlini". */
  parentName?: string;
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
  /**
   * Chosen daytime stops per day (index 0 = day 1), in visiting order: an AI plan or an edited plan. The engine
   * only times them (opening hours, walking, the day's window); a stop that does not fit is left out and listed in
   * `dropped`. No other place is added.
   */
  pinned?: readonly (readonly string[])[];
  /** "relaxed": fewer stops a day (`ITINERARY.relaxedMaxDaytimeStops`). */
  pace?: "relaxed" | "normal";
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
  /** Closing time when it is within 30 minutes of the visit's end: a real warning. */
  closesSoon: string | null;
  /** ISO code when the place is in another country (the Vatican from Rome). */
  country?: string;
  /** From the previous stop of the day; null for the first. */
  travel: Travel | null;
  /** Seen from outside only on this day; `note` says why or what to see. */
  exterior: { note: string | null } | null;
  /** Far from the centre (places/far.ts): "MERKEZE ~5 KM". Null when it is not; never set on a sub-stop. */
  farKm: number | null;
  /** OpenStreetMap, or Wikidata for a must-see place OSM does not have. */
  sourceUrl: string;
  source: "OpenStreetMap" | "Wikidata";
  /** Places inside this one (the Kremlin's Tsar Bell), seen during its visit: no time of their own, no walk between. */
  inside?: PlanSubStop[];
};

/** A place inside a stop, visited with it. */
export type PlanSubStop = Pick<PlanStop, "id" | "shortId" | "name" | "localName" | "category" | "lat" | "lon" | "hours" | "sourceUrl" | "source"> & {
  /** The place it is in: "Moskova Kremlini" ("MOSKOVA KREMLİNİ İÇİNDE"). */
  within: string;
};

/** The day's tags; the interface words them (messages `itinerary.tags`: "VARIŞ GÜNÜ", "ARRIVAL DAY"…). */
export type DayTag = "arrival" | "return" | "half" | "full";

/**
 * Why a day has fewer or no stops; the interface words it (messages `itinerary.notes`): the flight arrives at `time`
 * or leaves at `time` (with or without an evening place), no plan time is left, or nothing open fits.
 */
export type DayNote =
  | { kind: "arrive" | "leave"; time: string; evening: boolean }
  | { kind: "noTime" }
  | { kind: "noneOpen" };

export type PlanDay = {
  number: number;
  date: string;
  tags: DayTag[];
  /** When the day's plan may start and must end (local), null when no time is left that day. */
  window: { start: string; end: string } | null;
  /** The daytime part of the window (sightseeing), null when there is none. */
  daytime: { start: string; end: string } | null;
  stops: PlanStop[];
  /** Unplanned time between the last daytime stop and the evening place, when longer than 90 minutes. */
  free: { start: string; end: string } | null;
  /** Why a day has fewer or no stops. */
  note: DayNote | null;
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
  /** Pinned places that could not be timed (closed, no time left, or not in the data). */
  dropped: string[];
};


/** Seen from outside on `date` (YYYY-MM-DD): an exterior-only place outside its open months. */
const seenFromOutside = (p: PlanPlace, date: string) =>
  Boolean(p.exterior && !p.exterior.openMonths?.includes(Number(date.slice(5, 7))));

function visitMinutes(p: PlanPlace, kind: "daytime" | "evening", date: string): number {
  if (kind === "evening") return ITINERARY.visitMin.evening;
  if (seenFromOutside(p, date)) return p.exterior?.visitMin ?? ITINERARY.exteriorOnlyMin;
  if (p.visitMin) return p.visitMin;
  const base =
    p.category === "see" && (p.wikipediaCount ?? 0) >= ITINERARY.landmarkMinWikipedias
      ? ITINERARY.landmarkVisitMin
      : (ITINERARY.visitMin[p.category as DaytimeCategory] ?? ITINERARY.visitMin.see);
  return p.walkThrough ? Math.min(base, ITINERARY.walkThroughMaxMin) : base;
}

// Words that name a kind of place; a name made only of these (and small words) says little: "Torre de l'església".
const TYPE_WORDS = new Set(
  (
    "torre tower tour turm mirador viewpoint belvedere aussichtspunkt vista esglesia iglesia igreja chiesa church eglise kirche kerk kilise " +
    "capella chapel chapelle kapelle cappella font fuente fontana fountain brunnen statue estatua monument monumento placa plaza piazza " +
    "square place platz parc park parque jardi garden puerta porta gate tor pont puente ponte bridge brucke cami mosque cami"
  ).split(" "),
);
const SMALL_WORDS = new Set("de del la l el les los the of di du des der die das da do dos sur on e i y and et st saint san sant santa".split(" "));

/** "Torre de l'església", "Mirador": a type of place, not a name (unless the place is well known). */
export function isGenericName(p: { name: string; wikipediaCount?: number }): boolean {
  if ((p.wikipediaCount ?? 0) >= ITINERARY.mustSeeMinWikipedias) return false;
  const words = looseWords(p.name).filter((w) => !SMALL_WORDS.has(w));
  return words.length > 0 && words.length <= 2 && words.every((w) => TYPE_WORDS.has(w));
}
const looseWords = (name: string) =>
  name.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** A viewpoint without a Wikidata item: at most one a day, and only to fill a gap. */
const unnamedViewpoint = (p: PlanPlace) => p.category === "viewpoint" && !p.wikidataId && !p.wikipediaCount;
const onMustSeeList = (p: PlanPlace) =>
  (p.wikipediaCount ?? 0) >= ITINERARY.mustSeeMinWikipedias && !isGenericName(p) && !unnamedViewpoint(p);

/**
 * The trip's must-see list: the best-known places, as many as `capacity`,
 * museums at most 40% of it, and one visit per spot (places within 80 m of
 * a better-known one are the same visit).
 */
export function chooseMustSees(ordered: readonly PlanPlace[], capacity: number): PlanPlace[] {
  const museumCap = Math.max(1, Math.round(capacity * ITINERARY.mustSeeMuseumShare));
  const chosen: PlanPlace[] = [];
  let museums = 0;
  for (const p of ordered) {
    if (chosen.length >= capacity) break;
    if (!onMustSeeList(p)) continue;
    if (p.category === "museum" && museums >= museumCap) continue;
    if (chosen.some((c) => dist(c, p) <= ITINERARY.sameSpotKm)) continue;
    chosen.push(p);
    if (p.category === "museum") museums++;
  }
  return chosen;
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
export function chooseAnchors(ordered: PlanPlace[], count: number, farArea: (p: PlanPlace) => number | undefined = () => undefined): PlanPlace[] {
  const target = Math.min(count, ordered.length);
  const anchors: PlanPlace[] = [];
  // A far area is one area: at most one of its places is an anchor, so it never takes two days.
  const sameFarArea = (p: PlanPlace) => farArea(p) !== undefined && anchors.some((a) => farArea(a) === farArea(p));
  for (let minKm: number = ITINERARY.anchorMinKm; anchors.length < target && minKm >= 0.01; minKm /= 2) {
    for (const p of ordered) {
      if (anchors.length === target) break;
      if (!anchors.includes(p) && !sameFarArea(p) && anchors.every((a) => dist(a, p) >= minKm)) anchors.push(p);
    }
  }
  // Places on top of each other: fill up in importance order.
  for (const p of ordered) if (anchors.length < target && !anchors.includes(p) && !sameFarArea(p)) anchors.push(p);
  return anchors;
}

/**
 * The far places (places/far.ts) in far areas: two far places within walking distance of each other (the plan's
 * walking rule, travel.ts) are one area, and so is a chain of them (the Eiffel Tower, the Trocadéro and the Arc de
 * Triomphe). Place id → area number; areas are numbered in the order of `places`.
 */
export function farAreas(places: readonly PlanPlace[]): Map<string, number> {
  const far = places.filter((p) => p.farKm !== undefined);
  const area = new Map<string, number>();
  let next = 0;
  for (const seed of far) {
    if (area.has(seed.id)) continue;
    const n = next++;
    area.set(seed.id, n);
    for (const queue = [seed]; queue.length; ) {
      const p = queue.pop()!;
      for (const q of far) {
        if (!area.has(q.id) && !needsTransit(dist(p, q))) {
          area.set(q.id, n);
          queue.push(q);
        }
      }
    }
  }
  return area;
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

/** With `wait`, a later start is tried in steps of this many minutes. */
const WAIT_STEP_MIN = 15;
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
    if (i === 0) tags.push("arrival");
    if (i === count - 1) tags.push("return");
    tags.push(full ? "full" : "half");
    return { number: i + 1, date: addDays(input.depart, i), tags, daytime, evening };
  });
}

/** Free time between two moments (minutes past midnight), shown only when longer than 90 minutes. */
export function freeTimeBlock(from: number, to: number): { start: string; end: string } | null {
  return to - from > ITINERARY.freeTimeMin ? { start: hhmm(from), end: hhmm(to) } : null;
}

/** The calm note for a first or last day the flight leaves without daytime stops. */
function flightDayNote(first: boolean, flight: NonNullable<ItineraryInput["flight"]>, withEvening: boolean): DayNote | null {
  if (first && flight.arrive) return { kind: "arrive", time: flight.arrive.time, evening: withEvening };
  if (!first && flight.leave) return { kind: "leave", time: flight.leave.time, evening: withEvening };
  return null;
}

function toStop(
  p: PlanPlace,
  kind: "daytime" | "evening",
  date: string,
  start: number,
  travel: Travel | null,
  hours: "open" | "unknown",
  closesAt: number | null = null,
  inside: readonly { place: PlanPlace; hours: "open" | "unknown" }[] = [],
  durationMin = visitMinutes(p, kind, date),
): PlanStop {
  const outside = kind === "daytime" && seenFromOutside(p, date);
  const closesSoon = closesAt !== null && closesAt - (start + durationMin) <= ITINERARY.closingSoonMin ? hhmm(closesAt) : null;
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
    closesSoon,
    ...(p.country ? { country: p.country } : {}),
    travel,
    exterior: outside ? { note: p.exterior?.note ?? null } : null,
    farKm: p.farKm ?? null,
    ...sourceOf(p),
    ...(inside.length
      ? {
          inside: inside.map(({ place: c, hours: h }) => ({
            id: c.id,
            shortId: shortId(c.id),
            name: c.name,
            ...(c.localName ? { localName: c.localName } : {}),
            category: c.category,
            lat: c.lat,
            lon: c.lon,
            hours: h,
            ...sourceOf(c),
            within: c.parentName ?? p.name,
          })),
        }
      : {}),
  };
}

function sourceOf(p: PlanPlace): Pick<PlanStop, "sourceUrl" | "source"> {
  const wikidataOnly = p.id.startsWith("wikidata/");
  return {
    sourceUrl: wikidataOnly ? `https://www.wikidata.org/wiki/${p.wikidataId ?? p.id.slice(9)}` : `https://www.openstreetmap.org/${p.id}`,
    source: wikidataOnly ? "Wikidata" : "OpenStreetMap",
  };
}

/**
 * Place id → the place it is inside (data: Wikidata P361/P276, places/containment.ts), among `places`. The parent
 * must be a possible stop itself (not a residence closed to visitors) and not inside another place: one level.
 */
export function insideOf(places: readonly PlanPlace[]): Map<string, PlanPlace> {
  const byQid = new Map<string, PlanPlace>();
  for (const p of places) if (p.wikidataId && !p.noVisit && !byQid.has(p.wikidataId)) byQid.set(p.wikidataId, p);
  const out = new Map<string, PlanPlace>();
  for (const p of places) {
    const parent = p.parentId ? byQid.get(p.parentId) : undefined;
    if (parent && parent.id !== p.id && !(parent.parentId && byQid.has(parent.parentId))) out.set(p.id, parent);
  }
  return out;
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
 *
 * A place inside another one (the Tsar Bell in the Kremlin) is never a stop of
 * its own while that place can be planned: it comes with it, as a sub-stop
 * right after it, and the visit lasts as long as the longest of them.
 *
 * Places far from the centre (places/far.ts) form far areas (`farAreas`): a
 * far area's must-sees go to one day, a day goes to at most one far area, and
 * a far place fills only a day that already goes to its area.
 */
export function buildItinerary(input: ItineraryInput): Itinerary {
  const skip = new Set(input.skip);
  const allIds = new Set([...input.daytime, ...input.evening].map((p) => shortId(p.id)));
  // Sights mapped as several OSM objects count once (the shared rule in places/twins.ts). Twins are removed
  // before skipping, so removing a place never brings back its twin.
  // Residences closed to visitors are not plan stops (they stay in the guide).
  const pool = sameNameOnce(importanceOrder(input.daytime)).filter((p) => !p.noVisit);
  const parentOf = insideOf(pool);
  const skipped = (p: PlanPlace) => skip.has(shortId(p.id));
  // Removing a place removes what is inside it; bringing it back brings them back.
  const available = pool.filter((p) => !skipped(p) && !(parentOf.has(p.id) && skipped(parentOf.get(p.id)!)));
  const childrenOf = new Map<string, PlanPlace[]>();
  for (const p of available) {
    const parent = parentOf.get(p.id);
    if (parent) childrenOf.set(parent.id, [...(childrenOf.get(parent.id) ?? []), p]);
  }
  // The places the plan chooses from: the children ride along with their parent.
  const daytime = available.filter((p) => !parentOf.has(p.id));
  // Food and drink are not merged (the same name nearby is usually another branch of a chain); instead each
  // name is suggested as an evening place at most once in the plan.
  const seenEvening = new Set<string>();
  const evening = input.evening.filter((p) => !seenEvening.has(p.id) && seenEvening.add(p.id) && !skip.has(shortId(p.id)));
  const eveningNames = new Set<string>();
  const eveningRank = new Map(evening.map((p, i) => [p.id, (p.detailed ? 0 : 1) * 100_000 + i]));

  const days = frames(input);
  const maxStops = input.pace === "relaxed" ? ITINERARY.relaxedMaxDaytimeStops : ITINERARY.maxDaytimeStops;
  const dropped: string[] = [];
  const used = new Set<string>();
  const planned = new Map<number, PlanStop[]>(days.map((d) => [d.number, []]));

  // Days with the most daytime come first, then by date: they get the most important anchors.
  const length = (d: DayFrame) => (d.daytime ? d.daytime.end - d.daytime.start : 0);
  const order = days.filter((d) => d.daytime).sort((a, b) => length(b) - length(a) || a.number - b.number);

  // 1. The trip's must-see list, sized to the whole trip's daytime.
  const capacity = order.reduce((sum, d) => sum + Math.min(maxStops, Math.floor(length(d) / ITINERARY.mustSeeStopMin)), 0);
  const mustSees = chooseMustSees(daytime, capacity);
  const isMust = new Set(mustSees.map((p) => p.id));
  const topFive = new Set(mustSees.slice(0, 5).map((p) => p.id));

  // 2. Areas: one anchor per day among the must-sees. The area with the most must-sees gets the longest day, so a
  //    dense old town is not squeezed into an arrival afternoon. A far area has at most one anchor.
  const farAreaOf = farAreas(daytime);
  const chosenAnchors = chooseAnchors(mustSees.length ? mustSees : daytime, order.length, (p) => farAreaOf.get(p.id));
  const nearestAnchor = (p: PlanPlace) =>
    chosenAnchors.reduce((best, a, i) => (dist(p, a) < dist(p, chosenAnchors[best]) - 1e-9 ? i : best), 0);
  const weight = chosenAnchors.map((_, i) => mustSees.filter((p) => nearestAnchor(p) === i).length);
  const byWeight = chosenAnchors
    .map((a, i) => ({ a, i }))
    .sort((x, y) => weight[y.i] - weight[x.i] || x.i - y.i)
    .map(({ a }) => a);
  // The area of the trip's best-known must-see takes the first long day, however thin it is (Sagrada Família on
  // day 2, not on the way home); among days of the same length, areas follow their best-known must-see.
  const topArea = mustSees.length ? byWeight.indexOf(chosenAnchors[nearestAnchor(mustSees[0])]) : -1;
  if (topArea > 0) byWeight.unshift(...byWeight.splice(topArea, 1));
  const bestRankOf = (i: number) => {
    const rank = mustSees.findIndex((p) => byWeight.reduce((best, a, j) => (dist(p, a) < dist(p, byWeight[best]) - 1e-9 ? j : best), 0) === i);
    return rank === -1 ? Infinity : rank;
  };
  const anchors: PlanPlace[] = [];
  for (let start = 0; start < byWeight.length; ) {
    let end = start + 1;
    while (end < byWeight.length && end < order.length && start < order.length && length(order[end]) === length(order[start])) end++;
    const group = Array.from({ length: end - start }, (_, k) => start + k).sort((x, y) => bestRankOf(x) - bestRankOf(y) || x - y);
    anchors.push(...group.map((i) => byWeight[i]));
    start = end;
  }
  const areaOf = new Map<string, number>();
  for (const p of daytime) {
    let best = 0;
    anchors.forEach((a, i) => {
      if (dist(p, a) < dist(p, anchors[best]) - 1e-9) best = i;
    });
    areaOf.set(p.id, best);
  }

  // Must-sees go to days by area, but each day only takes what it can hold: in importance order, a place goes to
  // the day with the nearest anchor that still has room, so neighbourhoods stay together and none is crowded out.
  const dayCapacity = (d: DayFrame) => Math.min(maxStops, Math.floor(length(d) / ITINERARY.mustSeeStopMin));
  const room = order.map(dayCapacity);
  const mustDay = new Map<string, number>();
  // A far area's must-sees share one day (its anchor's, else the first one's), and a day takes one far area.
  const farDay = new Map<number, number>();
  const dayFar = new Map<number, number>();
  const goesTo = (day: number, area: number) => {
    farDay.set(area, day);
    dayFar.set(day, area);
  };
  anchors.forEach((a, i) => {
    const area = farAreaOf.get(a.id);
    if (area !== undefined) goesTo(i, area);
  });
  for (const p of mustSees) {
    const area = farAreaOf.get(p.id);
    const fits = (i: number) =>
      i < room.length && room[i] > 0 && (area === undefined || (farDay.has(area) ? farDay.get(area) === i : !dayFar.has(i)));
    const byAnchor = anchors.map((a, i) => i).sort((i, j) => dist(p, anchors[i]) - dist(p, anchors[j]) || i - j);
    const target = byAnchor.find(fits);
    if (target === undefined) continue;
    if (area !== undefined && !farDay.has(area)) goesTo(target, area);
    mustDay.set(p.id, target);
    room[target]--;
  }

  // A day being built: its stops so far, where it is and when, and the far area it goes to.
  type Build = { day: DayFrame; area: number; stops: PlanStop[]; at: PlanPlace | null; clock: number; viewpoints: number; far?: number };
  const builds: Build[] = order.map((day, area) => ({ day, area, stops: [], at: null, clock: day.daytime!.start, viewpoints: 0, far: dayFar.get(area) }));
  /** A day goes to one far area at most (a chosen plan is timed as given). */
  const otherFarArea = (b: Build, p: PlanPlace) => {
    const area = farAreaOf.get(p.id);
    return !input.pinned && area !== undefined && b.far !== undefined && b.far !== area;
  };
  const byPlace = new Map(available.map((p) => [p.id, p]));
  /** Another record of a place already in the plan (within 80 m): the same visit. */
  const sameSpotTaken = (p: PlanPlace) =>
    [...used].some((id) => {
      const q = byPlace.get(id);
      return q ? dist(q, p) <= ITINERARY.sameSpotKm : false;
    });

  /**
   * Appends `p` to the day if it fits before the day ends and is not surely closed then. With `wait`, a place
   * that is closed at the next free moment may start later that day, when it opens (for the top five).
   * The places inside `p` come with it (unless it is seen from outside that day, or one is surely closed then):
   * no time of their own, but the visit lasts as long as the longest of them.
   */
  const tryAppend = (b: Build, p: PlanPlace, wait = false): boolean => {
    if (b.stops.length >= maxStops || used.has(p.id) || sameSpotTaken(p) || otherFarArea(b, p)) return false;
    const window = b.day.daytime!;
    const base = (b.day.number - 1) * 1440;
    const weekday = weekdayOf(b.day.date);
    const travel: Travel | null = b.at ? travelBetween(b.at, p) : null;
    const own = visitMinutes(p, "daytime", b.day.date);
    const children = seenFromOutside(p, b.day.date) ? [] : (childrenOf.get(p.id) ?? []).filter((c) => !used.has(c.id));
    const longest = (list: readonly PlanPlace[]) => Math.max(own, ...list.map((c) => visitMinutes(c, "daytime", b.day.date)));
    const visit = longest(children);
    for (let start = roundUp(b.clock + (travel?.scheduledMin ?? 0)); start + visit <= window.end; start += WAIT_STEP_MIN) {
      const { verdict, closesAt } = openCheck(p.openingHours, weekday, start - base, start + visit - base);
      if (verdict !== "closed") {
        const inside = children.flatMap((c) => {
          const check = openCheck(c.openingHours, weekday, start - base, start + visit - base).verdict;
          return check === "closed" ? [] : [{ place: c, hours: check === "open" ? ("open" as const) : ("unknown" as const) }];
        });
        const duration = longest(inside.map((c) => c.place));
        b.stops.push(toStop(p, "daytime", b.day.date, start - base, travel, verdict, closesAt, inside, duration));
        used.add(p.id);
        for (const c of inside) used.add(c.place.id);
        b.at = p;
        b.clock = start + duration;
        b.far ??= farAreaOf.get(p.id);
        if (unnamedViewpoint(p)) b.viewpoints++;
        return true;
      }
      if (!wait) return false;
    }
    return false;
  };
  const nearFirst = (from: PlanPlace | null, list: PlanPlace[]) =>
    from ? [...list].sort((a, b) => dist(from, a) - dist(from, b) || byId(a, b)) : list;
  /** Keeps appending the nearest candidate that fits; stops when none does. */
  const fill = (b: Build, pool: () => PlanPlace[]) => {
    for (;;) {
      const next = nearFirst(b.at, pool()).find((p) => tryAppend(b, p));
      if (!next) return;
    }
  };

  if (input.pinned) {
    // A chosen plan: each day's stops in the given order, timed by the same rules; nothing else is added, except
    // the places inside a chosen one. A place inside a chosen one goes with it, whatever day it was given.
    const chosen = new Set(input.pinned.flat());
    for (const b of builds) {
      for (const id of input.pinned[b.day.number - 1] ?? []) {
        const parent = parentOf.get(id);
        if (parent && byPlace.has(parent.id) && chosen.has(parent.id)) continue;
        const p = byPlace.get(id);
        if (!p || !tryAppend(b, p, true)) dropped.push(id);
      }
      planned.set(b.day.number, b.stops);
    }
    for (const [i, ids] of input.pinned.entries()) {
      if (!builds.some((b) => b.day.number === i + 1)) dropped.push(...ids);
    }
  } else {
    // 3. The five best-known places first, before anything can fill their days: each on its area's day, or else the
    //    first day it is open, waiting for its opening time if needed. Only capacity or being closed all trip keeps
    //    one out.
    for (const p of mustSees.filter((q) => topFive.has(q.id))) {
      const own = builds.filter((b) => b.area === mustDay.get(p.id));
      const others = builds.filter((b) => b.area !== mustDay.get(p.id)).sort((a, b) => a.day.number - b.day.number);
      [...own, ...others].find((b) => tryAppend(b, p, true));
    }
    // 4. Each day takes the rest of its must-sees, starting with the most important, then nearest neighbour. A day
    //    that starts in its far area sees that area's must-sees first, one after another: one way out, not two.
    for (const b of builds) {
      const own = mustSees.filter((p) => mustDay.get(p.id) === b.area);
      if (b.at === null) own.find((p) => tryAppend(b, p));
      const inFarArea = (p: PlanPlace) => b.far !== undefined && farAreaOf.get(p.id) === b.far;
      if (b.at && inFarArea(b.at)) fill(b, () => own.filter((p) => !used.has(p.id) && inFarArea(p)));
      fill(b, () => own.filter((p) => !used.has(p.id)));
    }
    // 5. Must-sees that did not fit their area's day (time, or closed that day) go to another day with room, nearest first.
    //    A far one goes to a day that already goes to its far area, else to a day that goes to none.
    for (const p of mustSees.filter((q) => !used.has(q.id))) {
      const byDistance = [...builds].sort(
        (a, b) => (a.at ? dist(a.at, p) : Infinity) - (b.at ? dist(b.at, p) : Infinity) || a.day.number - b.day.number,
      );
      const area = farAreaOf.get(p.id);
      const days = area === undefined ? byDistance : [...byDistance.filter((b) => b.far === area), ...byDistance.filter((b) => b.far === undefined)];
      days.find((b) => tryAppend(b, p));
    }
    // 6. Fill the remaining time: other known places, then little-known ones, then names that only say what they are,
    //    and at most one viewpoint without a Wikidata item a day. A far place fills only a day that goes to its area.
    for (const b of builds) {
      const nearOrHere = (p: PlanPlace) => !farAreaOf.has(p.id) || (b.far !== undefined && farAreaOf.get(p.id) === b.far);
      const rest = () => daytime.filter((p) => !used.has(p.id) && !isMust.has(p.id) && nearOrHere(p));
      const ownFirst = (list: PlanPlace[]) => [...list.filter((p) => areaOf.get(p.id) === b.area), ...list.filter((p) => areaOf.get(p.id) !== b.area)];
      // On a day out to a far area, its other known places come first: it is seen in one go.
      fill(b, () => rest().filter((p) => farAreaOf.has(p.id) && onMustSeeList(p)));
      fill(b, () => ownFirst(rest().filter(onMustSeeList)));
      fill(b, () => ownFirst(rest().filter((p) => !onMustSeeList(p) && !isGenericName(p) && !unnamedViewpoint(p))));
      fill(b, () => ownFirst(rest().filter((p) => isGenericName(p) && !unnamedViewpoint(p))));
      if (b.viewpoints < 1) nearFirst(b.at, rest().filter(unnamedViewpoint)).find((p) => tryAppend(b, p));
      planned.set(b.day.number, b.stops);
    }
  }

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
      .map((p) => ({ p, ...openCheck(p.openingHours, weekday, start, end), km: dist(ref, p) }))
      .filter((c) => c.verdict !== "closed");
    const close = open.filter((c) => c.km <= ITINERARY.eveningRadiusKm);
    const pick = (close.length
      ? close.sort((a, b) => eveningRank.get(a.p.id)! - eveningRank.get(b.p.id)! || byId(a.p, b.p))
      : open.sort((a, b) => a.km - b.km || byId(a.p, b.p)))[0];
    if (!pick) continue;
    used.add(pick.p.id);
    eveningNames.add(nameKey(pick.p));
    const travel = lastStop ? travelBetween(lastStop, pick.p) : null;
    stops.push(toStop(pick.p, "evening", day.date, start, travel, pick.verdict === "open" ? "open" : "unknown", pick.closesAt));
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
          ? ({ kind: "noTime" } as const)
          : stops.length === 0
            ? ({ kind: "noneOpen" } as const)
            : null);
      const daytime = d.daytime ? { start: hhmm(d.daytime.start - base), end: hhmm(d.daytime.end - base) } : null;
      return { number: d.number, date: d.date, tags: d.tags, window, daytime, stops, free, note, flightNote: flightNote !== null };
    }),
    basis: input.flight?.arrive && input.flight?.leave ? "flight" : "assumed",
    timeZone: input.timeZone,
    skipped: input.skip.filter((s) => allIds.has(s)),
    dropped,
  };
}
