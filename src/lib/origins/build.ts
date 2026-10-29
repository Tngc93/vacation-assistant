import { normalizeForSearch } from "@/lib/search/normalize";
import { ORIGINS_FILE_VERSION, type OriginsFile, type StoredOrigin } from "./file";

/**
 * Builds src/data/origins.json from Travelpayouts' static data and Wikidata labels (pure; the network is in
 * scripts/fetch-origins.mts).
 *
 * Which cities: every Travelpayouts city with `has_flightable_airport`, and of its entries in airports.json only
 * real airports (`iata_type: "airport"`) that are `flightable`; railway and bus stations, heliports and closed
 * airports (TXL, SXF) are left out. Codes outside A–Z (Travelpayouts' internal Cyrillic codes) are left out too.
 *
 * Which Turkish name, first that exists:
 * 1. one of our 68 destinations: its `nameTr` (the name the rest of the app uses);
 * 2. the Turkish Wikidata label of the city, found through its airports: an airport's IATA code (P238) and the
 *    places it serves (P931), kept only when that place's English, Turkish or native label matches the city's
 *    name in Travelpayouts (JFK serves "New York City", the city is "New York");
 * 3. Travelpayouts' Turkish name (data/tr/cities.json), when it says something (not the string "None");
 * 4. Travelpayouts' English name.
 * Wikidata comes before Travelpayouts' own Turkish file because that file has plain mistakes for well-known cities
 * (2026-10-29: New York "Newark", Madrid "Madrit", Naples in Florida "Napoli"); Wikidata's labels are edited by
 * people who read Turkish. No name is ever made up.
 */

export type TpCity = { code: string; name: string | null; country_code: string; time_zone: string | null; has_flightable_airport?: boolean };
export type TpAirport = { code: string; city_code: string; iata_type: string; flightable?: boolean; name: string | null };
/** One Wikidata place served by an airport (P238 → P931). */
export type WdServed = { iata: string; qid: string };
export type WdLabels = { tr?: string; en?: string; native: string[]; sitelinks: number };
export type DestinationName = { cityCode: string; nameTr: string; nameEn: string; aliases?: readonly string[] };

export type BuildInput = {
  cities: TpCity[];
  /** Travelpayouts' Turkish names by city code (data/tr/cities.json). */
  citiesTr: Map<string, string | null>;
  airports: TpAirport[];
  /** Travelpayouts' Turkish airport names by code (data/tr/airports.json). */
  airportsTr: Map<string, string | null>;
  served: WdServed[];
  labels: Map<string, WdLabels>;
  destinations: readonly DestinationName[];
  fetchedAt: string;
};

const IATA = /^[A-Z]{3}$/;

/** Travelpayouts writes "None" for a missing translation. */
function said(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed && trimmed !== "None" ? trimmed : null;
}

/** The Wikidata place an airport list serves whose name is the city's (most Wikipedia languages if several). */
export function matchWikidataCity(
  names: { en: string | null; tr: string | null },
  candidates: Iterable<string>,
  labels: Map<string, WdLabels>,
): string | null {
  const wanted = [names.en, names.tr].flatMap((n) => (n ? [normalizeForSearch(n)] : [])).filter(Boolean);
  let best: { qid: string; sitelinks: number } | null = null;
  for (const qid of candidates) {
    const l = labels.get(qid);
    if (!l) continue;
    const own = [l.en, l.tr, ...l.native].flatMap((n) => (n ? [normalizeForSearch(n)] : []));
    // "New York" is the city "New York City"; never the other way round ("York" is not "New York").
    const matches = wanted.some((w) => own.includes(w) || own.some((o) => o.startsWith(`${w} `)));
    if (matches && (!best || l.sitelinks > best.sitelinks)) best = { qid, sitelinks: l.sitelinks };
  }
  return best?.qid ?? null;
}

export function buildOrigins(input: BuildInput): OriginsFile {
  const airportsByCity = new Map<string, TpAirport[]>();
  for (const a of input.airports) {
    if (a.iata_type !== "airport" || !a.flightable || !IATA.test(a.code) || !IATA.test(a.city_code)) continue;
    const list = airportsByCity.get(a.city_code) ?? [];
    list.push(a);
    airportsByCity.set(a.city_code, list);
  }
  const servedBy = new Map<string, Set<string>>();
  for (const s of input.served) {
    const set = servedBy.get(s.iata) ?? new Set<string>();
    set.add(s.qid);
    servedBy.set(s.iata, set);
  }
  const destinations = new Map(input.destinations.map((d) => [d.cityCode, d]));

  const rows: Array<{ origin: StoredOrigin; sitelinks: number }> = [];
  for (const city of input.cities) {
    const airports = airportsByCity.get(city.code);
    if (!city.has_flightable_airport || !IATA.test(city.code) || !airports?.length || !city.time_zone || !/^[A-Z]{2}$/.test(city.country_code)) continue;
    const en = said(city.name);
    const tpTr = said(input.citiesTr.get(city.code));
    const candidates = new Set([city.code, ...airports.map((a) => a.code)].flatMap((code) => [...(servedBy.get(code) ?? [])]));
    const qid = matchWikidataCity({ en, tr: tpTr }, candidates, input.labels);
    const wd = qid ? input.labels.get(qid) : undefined;
    const destination = destinations.get(city.code);
    const name = destination?.nameTr ?? said(wd?.tr) ?? tpTr ?? en;
    if (!name) continue;

    const shown = normalizeForSearch(name);
    const aliases: string[] = [];
    for (const alias of [destination?.nameEn, ...(destination?.aliases ?? []), en, tpTr, wd?.tr, wd?.en, ...(wd?.native ?? [])]) {
      const a = said(alias);
      if (!a) continue;
      const key = normalizeForSearch(a);
      if (key && key !== shown && !aliases.some((x) => normalizeForSearch(x) === key)) aliases.push(a);
    }

    const origin: StoredOrigin = {
      code: city.code,
      name,
      country: city.country_code,
      timeZone: city.time_zone,
      airports: [...airports]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((a) => ({ code: a.code, name: said(input.airportsTr.get(a.code)) ?? said(a.name) ?? a.code })),
      ...(aliases.length ? { aliases } : {}),
    };
    rows.push({ origin, sitelinks: wd?.sitelinks ?? 0 });
  }

  rows.sort((a, b) => b.sitelinks - a.sitelinks || b.origin.airports.length - a.origin.airports.length || a.origin.code.localeCompare(b.origin.code));
  return {
    version: ORIGINS_FILE_VERSION,
    fetchedAt: input.fetchedAt,
    sources: ORIGINS_SOURCES,
    cities: rows.map((r) => r.origin),
  };
}

export const ORIGINS_SOURCES: OriginsFile["sources"] = [
  {
    name: "Travelpayouts (Aviasales) static data: cities.json, airports.json (en, tr)",
    url: "https://support.travelpayouts.com/hc/en-us/articles/360018907280-Flight-data-by-Aviasales",
    terms: "No licence stated; offered to Travelpayouts partners to embed in their projects (checked 2026-10-29).",
  },
  {
    name: "Wikidata: airport IATA codes (P238), places served (P931), Turkish, English and native labels",
    url: "https://www.wikidata.org/",
    terms: "CC0 1.0",
  },
];
