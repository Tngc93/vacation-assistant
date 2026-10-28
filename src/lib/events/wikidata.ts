/**
 * The city's big recurring events from Wikidata, used only by the data script (`npm run data:events`), never at
 * request time. Wikidata is the only source (Berk, 2026-10-28): no API keys, no scraping.
 *
 * 1. Candidates: items held in the city (P276 the city or a place whose P131 chain reaches it, P131 the same, or a
 *    coordinate within the city radius) that are a festival, carnival, fair, Christmas market, film or music
 *    festival (with their subclasses; the class map is fetched once per run). Editions, trade fairs and
 *    discontinued series are left out.
 * 2. Details: months (P2922, or P837 naming a month or a day of one), official website (P856), photo (P18) and the
 *    venue (P276 that is a place, not a settlement or an administrative area, with a P625).
 * 3. Editions: items in the series (P179, or an instance of it) with day-precise P580/P582 or P585.
 * An event without an exact edition in the 18 months from now and without months is dropped: no guessed dates.
 */
import { distanceKm } from "@/lib/geo";
import { externalFetch } from "@/lib/net";
import { readableName } from "@/lib/places/names";
import { sparql } from "@/lib/places/landmarks";
import type { Fetcher } from "@/lib/places/overpass";
import { commonsFileName, fetchCardPhotos } from "@/lib/places/photos";
import { fetchEntitySummaries } from "@/lib/places/wikidata";
import { addMonths } from "@/lib/search/dates";
import type { EventType, StoredEvent } from "./file";

/** Classes that make an item an event we show, with all their subclasses; the first matching type wins. */
export const EVENT_CLASSES: ReadonlyArray<readonly [string, EventType, string]> = [
  ["Q57607", "christmasMarket", "Christmas market"],
  ["Q4618", "carnival", "Carnival"],
  ["Q220505", "film", "film festival"],
  ["Q868557", "music", "music festival"],
  ["Q288514", "fair", "fair"],
  ["Q132241", "festival", "festival"],
];
/** Yearly editions ("recurring event edition"), with their subclasses (film festival edition…). */
export const EDITION_CLASS = "Q27968055";
/** Trade fairs (Bauma, EXPO REAL): business events, not a reason to visit. */
export const TRADE_FAIR_CLASS = "Q57305";
/** A P276 that is one of these is the city or a district, not a venue. */
export const NOT_A_VENUE_CLASSES = ["Q56061", "Q486972"] as const; // administrative territorial entity, human settlement
/**
 * Adult content (Berk, 2026-10-28): an event whose type (P31), main subject (P921) or genre (P136) is one of these
 * or a subclass of one is left out (Folsom Europe: main subject BDSM). Checked on Wikidata 2026-10-28.
 */
export const ADULT_CLASSES = {
  Q3519050: "eroticism",
  Q181001: "erotica",
  Q291: "pornography",
  Q190845: "BDSM",
  Q207791: "sexual fetishism",
  Q837322: "sex industry",
} as const;
/**
 * The same rule by name, for items Wikidata types only as a festival (the Brussels International Festival of
 * Eroticism is a "film festival" with no subject): an erotic, fetish or porn word in the Turkish or English label.
 */
export const ADULT_NAME = /\b(erotic|erotik|erotis|erotiz|fetish|feti[sş]|porn)/i;

/** Wikidata's month items, January to December. */
export const MONTH_QIDS = ["Q108", "Q109", "Q110", "Q118", "Q119", "Q120", "Q121", "Q122", "Q123", "Q124", "Q125", "Q126"] as const;

/** Candidates need this many sitelinks (any wiki) before any further check; the stored threshold is MIN_EVENT_WIKIPEDIAS. */
export const MIN_EVENT_SITELINKS = 3;
/**
 * Wikipedia languages an event needs to be shown (chosen from the real data, 2026-10-28): at 5, Oktoberfest (76),
 * the Carnival of Venice, the Berlinale and the Edinburgh festivals stay, and small local festivals with a page in
 * one or two languages go.
 */
export const MIN_EVENT_WIKIPEDIAS = 5;
/** Exact editions are kept from today up to this many months ahead (a trip can be booked 12 months out, plus 30 nights). */
export const EDITION_WINDOW_MONTHS = 18;
/** At most this many events per city. */
export const MAX_EVENTS = 30;
/**
 * A P276 farther than this from the centre (twice the city radius, at least 15 km) means the event moves from town to
 * town (the Royal National Mod is held all over Scotland): it is not the city's, and is left out.
 */
export const travellingKm = (radiusKm: number) => Math.max(radiusKm * 2, 15);

export function isTravelling(details: Pick<EventDetails, "places">, city: { lat: number; lon: number; radiusKm: number }): boolean {
  return details.places.some((p) => distanceKm(city.lat, city.lon, p.lat, p.lon) > travellingKm(city.radiusKm));
}

/** An event whose countries (P17) do not include the city's: a festival of Ancient Rome (Larentalia) is not Rome's today. */
export function isElsewhere(details: Pick<EventDetails, "countries">, countryCode: string): boolean {
  return details.countries.length > 0 && !details.countries.includes(countryCode);
}

type Binding = Record<string, { value: string } | undefined>;
const rowsOf = (json: unknown) => (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
const qidOf = (uri: string | undefined) => /Q[1-9]\d*$/.exec(uri ?? "")?.[0] ?? null;
const values = (qids: readonly string[]) => qids.map((q) => `wd:${q}`).join(" ");

/** "Point(11.55 48.13)" → { lat, lon } */
function point(wkt: string | undefined): { lat: number; lon: number } | null {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt ?? "");
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

/** Every subclass of the event, edition and trade fair classes, with the class it falls under. */
export function classesQuery(): string {
  const roots = [...EVENT_CLASSES.map(([q]) => q), EDITION_CLASS, TRADE_FAIR_CLASS];
  return `SELECT ?class ?root WHERE {
  VALUES ?root { ${values(roots)} }
  ?class wdt:P279* ?root .
}`;
}

/** class → the listed roots it is a subclass of (itself included). */
export type ClassMap = Map<string, Set<string>>;

export function parseClasses(json: unknown): ClassMap {
  const out: ClassMap = new Map();
  for (const b of rowsOf(json)) {
    const cls = qidOf(b.class?.value);
    const root = qidOf(b.root?.value);
    if (!cls || !root) continue;
    if (!out.has(cls)) out.set(cls, new Set());
    out.get(cls)!.add(root);
  }
  return out;
}

/**
 * Items held in the city with their direct types. The class check runs on our side (classifyCandidates): subclass
 * paths for thousands of Paris items time out on WDQS. Discontinued series and items in a series (editions) are
 * left out here.
 */
export function candidatesQuery(city: { wikidataId: string; lat: number; lon: number; radiusKm: number }, by: "admin" | "near"): string {
  // Two queries, each well under the WDQS limit for Paris and London. Optimizer off: the location patterns first.
  const where =
    by === "admin"
      ? `{ ?e wdt:P276 wd:${city.wikidataId} }
    UNION { ?e wdt:P131 wd:${city.wikidataId} }
    UNION { ?loc wdt:P131+ wd:${city.wikidataId} . ?e wdt:P276 ?loc }
    UNION { ?loc wdt:P131+ wd:${city.wikidataId} . ?e wdt:P131 ?loc }`
      : `SERVICE wikibase:around {
      ?e wdt:P625 ?coord .
      bd:serviceParam wikibase:center "Point(${city.lon} ${city.lat})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "${city.radiusKm}" .
    }`;
  return `SELECT ?e (GROUP_CONCAT(DISTINCT STRAFTER(STR(?type), "entity/"); separator=" ") AS ?types) WHERE {
  hint:Query hint:optimizer "None" .
  {
    ${where}
  }
  ?e wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_EVENT_SITELINKS})
  FILTER NOT EXISTS { ?e wdt:P179 ?series }
  FILTER NOT EXISTS { ?e wdt:P576 ?dissolved }
  FILTER NOT EXISTS { ?e wdt:P2669 ?discontinued }
  FILTER NOT EXISTS { ?e wdt:P582 ?ended }
  ?e wdt:P31 ?type .
}
GROUP BY ?e`;
}

/**
 * qid → its event type (the first of EVENT_CLASSES one of its types falls under). Editions and trade fairs are
 * left out, whatever else they are.
 */
export function classifyCandidates(json: unknown, classes: ClassMap): Map<string, EventType> {
  const out = new Map<string, EventType>();
  for (const b of rowsOf(json)) {
    const qid = qidOf(b.e?.value);
    if (!qid) continue;
    const roots = new Set((b.types?.value ?? "").split(" ").flatMap((t) => [...(classes.get(t) ?? [])]));
    if (roots.has(EDITION_CLASS) || roots.has(TRADE_FAIR_CLASS)) continue;
    const type = EVENT_CLASSES.find(([q]) => roots.has(q))?.[1];
    if (type) out.set(qid, type);
  }
  return out;
}

export function detailsQuery(qids: readonly string[]): string {
  return `SELECT ?e ?month ?site ?img ?venue ?venueCoord ?place ?placeCoord ?country ?cc ?adult WHERE {
  VALUES ?e { ${values(qids)} }
  VALUES ?m { ${values(MONTH_QIDS)} }
  {
    { ?e wdt:P2922 ?m . BIND(?m AS ?month) }
    UNION { ?e wdt:P837 ?m . BIND(?m AS ?month) }
    UNION { ?e wdt:P837 ?day . ?day wdt:P361 ?m . BIND(?m AS ?month) }
  }
  UNION { ?e wdt:P856 ?site }
  UNION { ?e wdt:P18 ?img }
  UNION {
    ?e wdt:P276 ?venue . ?venue wdt:P625 ?venueCoord .
    FILTER NOT EXISTS { ?venue wdt:P31/wdt:P279* ?area . VALUES ?area { ${values(NOT_A_VENUE_CLASSES)} } }
  }
  UNION {
    ?e wdt:P276 ?place . ?place wdt:P625 ?placeCoord .
    # A country (Sziget: "Hungary") or a first-level region says where the city is, not that the event moves.
    FILTER NOT EXISTS { ?place wdt:P297 ?iso }
    FILTER NOT EXISTS { ?place wdt:P31/wdt:P279* wd:Q10864048 }
  }
  UNION { ?e wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?cc } }
  UNION { ?e wdt:P31|wdt:P921|wdt:P136 ?topic . ?topic wdt:P279* ?adult . VALUES ?adult { ${values(Object.keys(ADULT_CLASSES))} } }
}`;
}

export type EventDetails = {
  months: number[];
  websites: string[];
  files: string[];
  venues: Array<{ qid: string; lat: number; lon: number }>;
  /**
   * Every P276 with a coordinate, venue or not, except countries and first-level regions: one far from the city
   * makes the event a travelling one.
   */
  places: Array<{ lat: number; lon: number }>;
  /** ISO codes of the event's countries (P17); "" for a country without one (Ancient Rome). */
  countries: string[];
  /** The type, main subject or genre falls under ADULT_CLASSES. */
  adult?: boolean;
};

export function parseDetails(json: unknown): Map<string, EventDetails> {
  const out = new Map<string, EventDetails>();
  const get = (qid: string) => {
    if (!out.has(qid)) out.set(qid, { months: [], websites: [], files: [], venues: [], places: [], countries: [] });
    return out.get(qid)!;
  };
  for (const b of rowsOf(json)) {
    const qid = qidOf(b.e?.value);
    if (!qid) continue;
    const d = get(qid);
    if (qidOf(b.adult?.value) && qidOf(b.adult?.value)! in ADULT_CLASSES) d.adult = true;
    const month = MONTH_QIDS.indexOf(qidOf(b.month?.value) as (typeof MONTH_QIDS)[number]) + 1;
    if (month > 0 && !d.months.includes(month)) d.months.push(month);
    const site = b.site?.value;
    if (site && /^https?:\/\//.test(site) && !d.websites.includes(site)) d.websites.push(site);
    const file = commonsFileName(b.img?.value);
    if (file && !d.files.includes(file)) d.files.push(file);
    const venue = qidOf(b.venue?.value);
    const at = point(b.venueCoord?.value);
    if (venue && at && !d.venues.some((v) => v.qid === venue)) d.venues.push({ qid: venue, ...at });
    const placeAt = point(b.placeCoord?.value);
    if (placeAt) d.places.push(placeAt);
    if (b.country?.value) {
      const cc = /^[A-Z]{2}$/.test(b.cc?.value ?? "") ? b.cc!.value : "";
      if (!d.countries.includes(cc)) d.countries.push(cc);
    }
  }
  for (const d of out.values()) {
    d.months.sort((a, b) => a - b);
    d.websites.sort((a, b) => Number(b.startsWith("https:")) - Number(a.startsWith("https:")) || a.length - b.length || (a < b ? -1 : 1));
    d.files.sort();
  }
  return out;
}

/** Editions with their dates and each date's precision; deprecated statements are left out. */
export function editionsQuery(qids: readonly string[]): string {
  const dated = (prop: string, v: string, p: string) =>
    `OPTIONAL { ?ed p:${prop} ?${v}St . ?${v}St psv:${prop} [ wikibase:timeValue ?${v} ; wikibase:timePrecision ?${p} ] . ?${v}St wikibase:rank ?${v}Rank . FILTER(?${v}Rank != wikibase:DeprecatedRank) }`;
  return `SELECT ?series ?ed ?start ?startPrec ?end ?endPrec ?at ?atPrec WHERE {
  VALUES ?series { ${values(qids)} }
  { ?ed wdt:P179 ?series } UNION { ?ed wdt:P31 ?series }
  ${dated("P580", "start", "startPrec")}
  ${dated("P582", "end", "endPrec")}
  ${dated("P585", "at", "atPrec")}
}`;
}

/** Day precision in the Wikibase time model. */
const DAY = 11;

export type Edition = { qid: string; start: string; end: string };

/**
 * series → its editions with day-precise dates: P580 and P582 both to the day, or P585 to the day (one day).
 * A start without an end, or a year or month only, is not an exact date.
 */
export function parseEditions(json: unknown): Map<string, Edition[]> {
  const out = new Map<string, Edition[]>();
  const day = (value: string | undefined, precision: string | undefined) =>
    value && Number(precision) === DAY && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : null;
  for (const b of rowsOf(json)) {
    const series = qidOf(b.series?.value);
    const qid = qidOf(b.ed?.value);
    if (!series || !qid) continue;
    const start = day(b.start?.value, b.startPrec?.value);
    const end = day(b.end?.value, b.endPrec?.value);
    const at = day(b.at?.value, b.atPrec?.value);
    const edition = start && end && start <= end ? { qid, start, end } : at ? { qid, start: at, end: at } : null;
    if (!edition) continue;
    const list = out.get(series) ?? [];
    if (!list.some((e) => e.qid === edition.qid && e.start === edition.start)) list.push(edition);
    out.set(series, list);
  }
  return out;
}

/** Editions that have not ended by `today` and start within EDITION_WINDOW_MONTHS, earliest first, one per item. */
export function editionsInWindow(editions: readonly Edition[], today: string): Edition[] {
  const last = addMonths(today, EDITION_WINDOW_MONTHS);
  const seen = new Set<string>();
  return [...editions]
    .filter((e) => e.end >= today && e.start <= last)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.qid < b.qid ? -1 : 1))
    .filter((e) => !seen.has(e.qid) && Boolean(seen.add(e.qid)));
}

export type RawEvent = {
  qid: string;
  type: EventType;
  labels: { tr?: string; en?: string };
  wikipedias: number;
  details: EventDetails;
  editions: Edition[];
  venue?: { qid: string; name: string; lat: number; lon: number };
};

/**
 * The stored event, or null when it is too minor (fewer than `minWikipedias` languages), has no Latin or Turkish
 * name, is adult content (ADULT_CLASSES or ADULT_NAME), or has neither an exact edition in the window nor months. Months covering more than half the year say
 * nothing about when to go and are not kept.
 */
export function toStoredEvent(raw: RawEvent, today: string, minWikipedias = MIN_EVENT_WIKIPEDIAS): Omit<StoredEvent, "photo"> | null {
  if (raw.wikipedias < minWikipedias) return null;
  const label = raw.labels.tr ?? raw.labels.en;
  if (!label) return null;
  if (raw.details.adult || [raw.labels.tr, raw.labels.en].some((l) => l && ADULT_NAME.test(l))) return null;
  const { name, localName } = readableName({ name: label, labels: raw.labels });
  const editions = editionsInWindow(raw.editions, today);
  const months = raw.details.months.length <= 6 ? raw.details.months : [];
  if (!editions.length && !months.length) return null;
  return {
    qid: raw.qid,
    name,
    ...(localName ? { localName } : {}),
    type: raw.type,
    wikipedias: raw.wikipedias,
    ...(editions.length ? { editions } : { months }),
    ...(raw.venue ? { venue: raw.venue } : {}),
    ...(raw.details.websites[0] ? { website: raw.details.websites[0] } : {}),
  };
}

const BATCH = 100;

/** Most known first, then by QID; at most MAX_EVENTS. */
export function rankEvents<T extends Pick<StoredEvent, "qid" | "wikipedias">>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => b.wikipedias - a.wikipedias || (a.qid < b.qid ? -1 : 1)).slice(0, MAX_EVENTS);
}

/** The class map, once per run. */
export async function fetchEventClasses({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<ClassMap> {
  return parseClasses(await sparql(classesQuery(), fetcher));
}

/** All of a city's events, ready to store. Throws if a query fails (the caller keeps the old file). */
export async function fetchCityEvents(
  city: { wikidataId: string; countryCode: string; lat: number; lon: number; radiusKm: number },
  {
    now,
    classes,
    exclude = [],
    fetcher = externalFetch,
    minWikipedias = MIN_EVENT_WIKIPEDIAS,
  }: { now: Date; classes: ClassMap; exclude?: readonly string[]; fetcher?: Fetcher; minWikipedias?: number },
): Promise<StoredEvent[]> {
  const today = now.toISOString().slice(0, 10);
  const types = new Map([
    ...classifyCandidates(await sparql(candidatesQuery(city, "admin"), fetcher), classes),
    ...classifyCandidates(await sparql(candidatesQuery(city, "near"), fetcher), classes),
  ]);
  const qids = [...types.keys()].filter((q) => !exclude.includes(q)).sort();
  const details = new Map<string, EventDetails>();
  const editions = new Map<string, Edition[]>();
  for (let i = 0; i < qids.length; i += BATCH) {
    const batch = qids.slice(i, i + BATCH);
    for (const [q, d] of parseDetails(await sparql(detailsQuery(batch), fetcher))) details.set(q, d);
    for (const [q, e] of parseEditions(await sparql(editionsQuery(batch), fetcher))) editions.set(q, e);
  }
  const venueQids = [...details.values()].flatMap((d) => (d.venues.length === 1 ? [d.venues[0].qid] : []));
  const summaries = await fetchEntitySummaries([...qids, ...venueQids], { fetcher });
  const stored = qids.flatMap((qid) => {
    const info = summaries.get(qid);
    const d = details.get(qid) ?? { months: [], websites: [], files: [], venues: [], places: [], countries: [] };
    if (isTravelling(d, city) || isElsewhere(d, city.countryCode)) return [];
    // One venue only: a festival spread over many places (the Fringe) has no single one to name.
    const v = d.venues.length === 1 ? d.venues[0] : undefined;
    const vInfo = v ? summaries.get(v.qid) : undefined;
    const vLabel = vInfo?.tr ?? vInfo?.en;
    const venue = v && vLabel ? { qid: v.qid, name: readableName({ name: vLabel, labels: vInfo }).name, lat: v.lat, lon: v.lon } : undefined;
    const event = info
      ? toStoredEvent(
          { qid, type: types.get(qid)!, labels: { tr: info.tr, en: info.en }, wikipedias: info.wikipedias, details: d, editions: editions.get(qid) ?? [], venue },
          today,
          minWikipedias,
        )
      : null;
    return event ? [{ event, file: d.files[0] }] : [];
  });
  const ranked = rankEvents(stored.map((s) => ({ ...s.event, file: s.file })));
  const photos = await fetchCardPhotos(ranked.flatMap((e) => e.file ?? []), { fetcher });
  return ranked.map(({ file, ...event }) => {
    const photo = file ? photos.get(file) : undefined;
    return photo ? { ...event, photo } : event;
  });
}
