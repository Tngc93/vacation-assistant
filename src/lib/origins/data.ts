import "server-only";
import raw from "@/data/origins.json";
import { DEFAULT_ORIGIN, type Origin, type OriginOption, toOriginOption } from "@/data/origins";
import type { Locale } from "@/i18n/locales";
import { COUNTRY_ALIASES, normalizeForSearch } from "@/lib/search/normalize";
import { originsFileSchema, type StoredOrigin } from "./file";

/**
 * The departure cities (src/data/origins.json), on the server only: the browser asks `/api/origins?q=` and gets a
 * handful of rows, never the list (`npm run check:bundle` checks).
 */

const file = originsFileSchema.parse(raw);
const regionNames = { tr: new Intl.DisplayNames("tr", { type: "region" }), en: new Intl.DisplayNames("en-GB", { type: "region" }) };

/** CLDR's English names, with "&" spelled out ("Bosnia and Herzegovina"). */
const countryIn = (code: string, locale: Locale) => (regionNames[locale].of(code) ?? code).replace(" & ", " and ");

function toOrigin(city: StoredOrigin, locale: Locale): Origin {
  const en = locale === "en";
  return {
    code: city.code,
    name: en ? (city.nameEn ?? city.name) : city.name,
    country: city.country,
    countryName: countryIn(city.country, locale),
    timeZone: city.timeZone,
    airports: city.airports.map((a) => ({ code: a.code, name: en ? (a.nameEn ?? a.name) : a.name })),
  };
}

const ORIGINS: Record<Locale, Origin[]> = { tr: file.cities.map((c) => toOrigin(c, "tr")), en: file.cities.map((c) => toOrigin(c, "en")) };
const byCity = new Map(file.cities.map((c, i) => [c.code, i]));
/** Airport code → its city, for links that name an airport (?from=SAW opens İstanbul, ?from=LHR London). */
const byAirport = new Map(file.cities.flatMap((c, i) => c.airports.map((a) => [a.code, i] as const)));

/**
 * The city a code names, in the interface language: a city code first (IST is İstanbul, not only its new airport),
 * then an airport code.
 */
export function findOrigin(code: string | null | undefined, locale: Locale = "tr"): Origin | undefined {
  const c = code?.trim().toUpperCase();
  if (!c) return undefined;
  const index = byCity.get(c) ?? byAirport.get(c);
  return index === undefined ? undefined : ORIGINS[locale][index];
}

/** İstanbul; the file is checked to contain it (src/lib/origins/data.test.ts). */
export const DEFAULT_ORIGIN_CITY: Origin = findOrigin(DEFAULT_ORIGIN)!;

/** The origin for a plan: the one the link names, or İstanbul when it names none or one we do not know. */
export function resolveOrigin(code: string | null | undefined, locale: Locale = "tr"): Origin {
  return findOrigin(code, locale) ?? findOrigin(DEFAULT_ORIGIN, locale)!;
}

type Indexed = { rank: number; names: string[]; countries: string[]; codes: string[] };

const INDEX: Indexed[] = file.cities.map((city, rank) => ({
  rank,
  names: [city.name, ...(city.nameEn ? [city.nameEn] : []), ...(city.aliases ?? [])].map(normalizeForSearch),
  countries: [countryIn(city.country, "tr"), countryIn(city.country, "en"), ...(COUNTRY_ALIASES[city.country] ?? [])].map(
    normalizeForSearch,
  ),
  codes: [city.code, ...city.airports.map((a) => a.code)].map((c) => c.toLowerCase()),
}));

/** Same tiers as the destination search (src/lib/search/normalize.ts); ties go to the better known city. */
function score(entry: Indexed, query: string): number | null {
  if (entry.codes[0] === query) return 0;
  if (entry.codes.includes(query)) return 1;
  if (entry.names.some((n) => n.startsWith(query))) return 2;
  if (entry.countries.some((c) => c.startsWith(query))) return 3;
  if (entry.names.some((n) => n.split(" ").some((w) => w.startsWith(query)))) return 4;
  return null;
}

export const ORIGIN_RESULTS = 8;

/**
 * Cities matching a name (Turkish, English or local, any Turkish letters or none), a country (Turkish or English)
 * or an IATA code, named in the interface language.
 */
export function searchOrigins(query: string, limit = ORIGIN_RESULTS, locale: Locale = "tr"): OriginOption[] {
  const q = normalizeForSearch(query).slice(0, 60);
  if (!q) return ORIGINS[locale].slice(0, limit).map(toOriginOption);
  const hits: Array<{ entry: Indexed; s: number }> = [];
  for (const entry of INDEX) {
    const s = score(entry, q);
    if (s !== null) hits.push({ entry, s });
  }
  return hits
    .sort((a, b) => a.s - b.s || a.entry.rank - b.entry.rank)
    .slice(0, limit)
    .map((h) => toOriginOption(ORIGINS[locale][h.entry.rank]));
}

export const ORIGINS_COUNT = file.cities.length;
