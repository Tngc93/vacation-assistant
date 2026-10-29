import { normalizeForSearch } from "@/lib/search/normalize";
import { ORIGINS_FILE_VERSION, type OriginsFile, type StoredOrigin } from "./file";
import type { MetroArea } from "./metros";

/**
 * Builds src/data/origins.json (pure; the network is in source.ts and scripts/fetch-origins.mts). No file derived
 * from Travelpayouts is used: its static data has no licence for redistribution, and this repository is public.
 *
 * Which airports (OurAirports, public domain): an IATA code, `scheduled_service=yes`, a large or medium airport.
 *
 * Which city:
 * 1. a metropolitan area in metros.ts (LON, NYC, IST…) or one of our 68 destinations: its code, its airports;
 * 2. otherwise airports with the same municipality, country and region (two Springfields are two cities) within
 *    100 km of the group's largest airport; the group's code is that airport's (one-airport cities keep their
 *    airport code, ESB for Ankara).
 *
 * Which names, first that exists (no name is ever made up):
 * - city: a destination's `nameTr`; the Wikidata Turkish label, then English, of the metro area's item, of a
 *   destination's item, or of the place an airport serves (P931) whose label is the municipality's (or the one
 *   place served, when it lies within 50 km); OurAirports' municipality;
 * - airport: the Wikidata Turkish label, then English, of the airport's item (P238); OurAirports' name.
 *
 * Time zone: the IANA zone of the nearest GeoNames place (cities1000, CC BY 4.0) in the airport's country; in
 * China always Asia/Shanghai (one official zone; airports in Xinjiang keep Beijing time).
 */

export type OaAirport = {
  iata: string;
  type: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  municipality: string;
  scheduled: boolean;
};
export type GeoPlace = { lat: number; lon: number; country: string; timeZone: string };
/** The Wikidata item of an airport (one per IATA code) and the places it serves. */
export type WdAirport = { iata: string; qid: string; tr?: string; en?: string; sitelinks: number; served: string[] };
export type WdPlace = { qid: string; tr?: string; en?: string; native: string[]; sitelinks: number; lat?: number; lon?: number };
export type DestinationRef = {
  cityCode: string;
  nameTr: string;
  nameEn: string;
  wikidataId: string;
  airports: readonly string[];
  aliases?: readonly string[];
};

export type BuildInput = {
  airports: OaAirport[];
  places: GeoPlace[];
  wdAirports: WdAirport[];
  /** Labels of the places airports serve, of the metro areas and of the destinations. */
  wdPlaces: Map<string, WdPlace>;
  destinations: readonly DestinationRef[];
  metros: readonly MetroArea[];
  fetchedAt: string;
};

const IATA = /^[A-Z]{3}$/;
const TYPES = new Set(["large_airport", "medium_airport"]);
/** Airports of one municipality farther apart than this are different cities. */
export const SAME_CITY_KM = 100;
/** The one place an airport serves names its city only this close. */
export const SERVED_PLACE_KM = 50;
const COUNTRY_TIME_ZONES: Record<string, string> = { CN: "Asia/Shanghai" };

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "Paris (Roissy-en-France, Val-d'Oise)" → Paris, Roissy-en-France, Val-d'Oise; "Stockholm / Västerås" → both; "Ferno (VA)" → Ferno. */
export function municipalityParts(municipality: string): string[] {
  return (
    municipality
      .split(/[,()/]/)
      .map((p) => p.trim())
      // Province codes ("Ferno (VA)", "Segrate (MI)") are not names.
      .filter((p) => p.length > 2)
  );
}

const supportedZones = new Set(Intl.supportedValuesOf("timeZone"));
const isZone = (tz: string) => {
  if (supportedZones.has(tz)) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** The IANA zone of the nearest GeoNames place in the same country (a country rule first). */
export function timeZoneFor(airport: OaAirport, placesByCountry: Map<string, GeoPlace[]>): string | null {
  const fixed = COUNTRY_TIME_ZONES[airport.country];
  if (fixed) return fixed;
  let best: GeoPlace | null = null;
  let bestKm = Infinity;
  for (const p of placesByCountry.get(airport.country) ?? []) {
    if (!isZone(p.timeZone)) continue;
    const km = distanceKm(airport, p);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  return best?.timeZone ?? null;
}

/** The place airports serve whose name is the municipality's; or the only one, when it is close. */
export function matchServedPlace(
  municipalities: readonly string[],
  candidates: Iterable<string>,
  places: Map<string, WdPlace>,
  near: { lat: number; lon: number },
): string | null {
  const wanted = municipalities.flatMap(municipalityParts).map(normalizeForSearch).filter(Boolean);
  const known = [...new Set(candidates)].flatMap((qid) => (places.has(qid) ? [places.get(qid)!] : []));
  let best: WdPlace | null = null;
  for (const p of known) {
    const own = [p.en, p.tr, ...p.native].flatMap((n) => (n ? [normalizeForSearch(n)] : []));
    // "New York" is the city "New York City"; never the other way round ("York" is not "New York").
    const matches = wanted.some((w) => own.includes(w) || own.some((o) => o.startsWith(`${w} `)));
    if (matches && (!best || p.sitelinks > best.sitelinks)) best = p;
  }
  if (best) return best.qid;
  if (known.length === 1 && known[0].lat !== undefined && known[0].lon !== undefined) {
    return distanceKm(near, { lat: known[0].lat, lon: known[0].lon }) <= SERVED_PLACE_KM ? known[0].qid : null;
  }
  return null;
}

const rank = (a: OaAirport) => (a.type === "large_airport" ? 0 : 1);
const byRank = (a: OaAirport, b: OaAirport) => rank(a) - rank(b) || a.iata.localeCompare(b.iata);

type Group = { code: string; airports: OaAirport[]; qid?: string; destination?: DestinationRef; metro?: MetroArea };

/** Metro areas and destinations, then the remaining airports by municipality. */
export function groupAirports(input: Pick<BuildInput, "airports" | "destinations" | "metros">): Group[] {
  const all = new Map<string, OaAirport>();
  for (const a of input.airports) {
    if (!IATA.test(a.iata) || !TYPES.has(a.type)) continue;
    const current = all.get(a.iata);
    // Several rows may share a code; the scheduled, larger one wins.
    if (!current || (a.scheduled && !current.scheduled) || (a.scheduled === current.scheduled && rank(a) < rank(current))) all.set(a.iata, a);
  }
  const taken = new Set<string>();
  const groups = new Map<string, Group>();
  const fixed = (code: string, airports: readonly string[], extra: Partial<Group>) => {
    const group = groups.get(code) ?? { code, airports: [] };
    for (const iata of airports) {
      const a = all.get(iata);
      if (!a || taken.has(iata)) continue;
      taken.add(iata);
      group.airports.push(a);
    }
    Object.assign(group, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)));
    if (group.airports.length) groups.set(code, group);
  };
  for (const d of input.destinations) fixed(d.cityCode, d.airports, { destination: d, qid: d.wikidataId });
  for (const m of input.metros) fixed(m.code, m.airports, { metro: m, qid: groups.get(m.code)?.qid ?? m.qid });

  const byMunicipality = new Map<string, Group[]>();
  for (const a of [...all.values()].filter((x) => x.scheduled && !taken.has(x.iata)).sort(byRank)) {
    const key = a.municipality ? `${a.country}|${a.region}|${normalizeForSearch(municipalityParts(a.municipality)[0] ?? "")}` : "";
    const near = key ? byMunicipality.get(key)?.find((g) => distanceKm(g.airports[0], a) <= SAME_CITY_KM) : undefined;
    if (near) {
      near.airports.push(a);
      continue;
    }
    // A metro code that is also another city's airport code would hide that city; none does today.
    if (groups.has(a.iata)) throw new Error(`${a.iata} (${a.name}) is also the code of ${groups.get(a.iata)!.airports.map((x) => x.iata).join("+")}`);
    const group: Group = { code: a.iata, airports: [a] };
    if (key) byMunicipality.set(key, [...(byMunicipality.get(key) ?? []), group]);
    groups.set(a.iata, group);
  }
  return [...groups.values()];
}

export function buildOrigins(input: BuildInput): OriginsFile {
  const placesByCountry = new Map<string, GeoPlace[]>();
  for (const p of input.places) placesByCountry.set(p.country, [...(placesByCountry.get(p.country) ?? []), p]);
  const wdAirports = new Map(input.wdAirports.map((a) => [a.iata, a]));

  const rows: Array<{ origin: StoredOrigin; sitelinks: number; large: number }> = [];
  for (const group of groupAirports(input)) {
    const airports = [...group.airports].sort((a, b) => a.iata.localeCompare(b.iata));
    const main = [...group.airports].sort(byRank)[0];
    const timeZone = timeZoneFor(main, placesByCountry);
    if (!timeZone || !/^[A-Z]{2}$/.test(main.country)) continue;

    const qid =
      group.qid ??
      matchServedPlace(
        airports.map((a) => a.municipality),
        airports.flatMap((a) => wdAirports.get(a.iata)?.served ?? []),
        input.wdPlaces,
        main,
      );
    const wd = qid ? input.wdPlaces.get(qid) : undefined;
    const municipality = municipalityParts(main.municipality)[0];
    const name = group.destination?.nameTr ?? wd?.tr ?? wd?.en ?? group.metro?.nameEn ?? municipality ?? main.name;

    const shown = normalizeForSearch(name);
    const aliases: string[] = [];
    const extra = [
      group.destination?.nameEn,
      ...(group.destination?.aliases ?? []),
      wd?.tr,
      wd?.en,
      ...(wd?.native ?? []),
      group.metro?.nameEn,
      ...airports.flatMap((a) => municipalityParts(a.municipality)),
    ];
    for (const alias of extra) {
      const a = alias?.trim();
      if (!a) continue;
      const key = normalizeForSearch(a);
      if (key && key !== shown && !aliases.some((x) => normalizeForSearch(x) === key)) aliases.push(a);
    }

    rows.push({
      origin: {
        code: group.code,
        name,
        country: main.country,
        timeZone,
        airports: airports.map((a) => {
          const item = wdAirports.get(a.iata);
          return { code: a.iata, name: item?.tr ?? item?.en ?? a.name };
        }),
        ...(aliases.length ? { aliases } : {}),
      },
      sitelinks: wd?.sitelinks ?? 0,
      large: airports.filter((a) => a.type === "large_airport").length,
    });
  }

  rows.sort((a, b) => b.sitelinks - a.sitelinks || b.large - a.large || a.origin.code.localeCompare(b.origin.code));
  return { version: ORIGINS_FILE_VERSION, fetchedAt: input.fetchedAt, sources: ORIGINS_SOURCES, cities: rows.map((r) => r.origin) };
}

export const ORIGINS_SOURCES: OriginsFile["sources"] = [
  {
    name: "OurAirports: airports.csv (IATA code, scheduled service, large and medium airports)",
    url: "https://ourairports.com/data/",
    terms: "Public Domain",
  },
  {
    name: "Wikidata: airport IATA codes (P238), places served (P931), Turkish, English and native labels",
    url: "https://www.wikidata.org/",
    terms: "CC0 1.0",
  },
  {
    name: "GeoNames: cities1000 (time zone of the nearest place)",
    url: "https://www.geonames.org/",
    terms: "CC BY 4.0",
  },
];
