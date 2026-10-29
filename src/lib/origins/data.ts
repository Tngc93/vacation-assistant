import "server-only";
import raw from "@/data/origins.json";
import { DEFAULT_ORIGIN, type Origin, type OriginOption, toOriginOption } from "@/data/origins";
import { COUNTRY_ALIASES, normalizeForSearch } from "@/lib/search/normalize";
import { originsFileSchema, type StoredOrigin } from "./file";

/**
 * The departure cities (src/data/origins.json), on the server only: the browser asks `/api/origins?q=` and gets a
 * handful of rows, never the list (`npm run check:bundle` checks).
 */

const file = originsFileSchema.parse(raw);
const regionNames = new Intl.DisplayNames("tr", { type: "region" });

function toOrigin(city: StoredOrigin): Origin {
  return {
    code: city.code,
    name: city.name,
    country: city.country,
    countryTr: regionNames.of(city.country) ?? city.country,
    timeZone: city.timeZone,
    airports: city.airports,
  };
}

const ORIGINS: Origin[] = file.cities.map(toOrigin);
const byCity = new Map(ORIGINS.map((o) => [o.code, o]));
/** Airport code → its city, for links that name an airport (?from=ESB opens Ankara, ?from=SAW İstanbul). */
const byAirport = new Map(ORIGINS.flatMap((o) => o.airports.map((a) => [a.code, o] as const)));

/** The city a code names: a city code first (IST is İstanbul, not only its new airport), then an airport code. */
export function findOrigin(code: string | null | undefined): Origin | undefined {
  const c = code?.trim().toUpperCase();
  if (!c) return undefined;
  return byCity.get(c) ?? byAirport.get(c);
}

/** İstanbul; the file is checked to contain it (src/lib/origins/data.test.ts). */
export const DEFAULT_ORIGIN_CITY: Origin = byCity.get(DEFAULT_ORIGIN)!;

/** The origin for a plan: the one the link names, or İstanbul when it names none or one we do not know. */
export function resolveOrigin(code: string | null | undefined): Origin {
  return findOrigin(code) ?? DEFAULT_ORIGIN_CITY;
}

type Indexed = { origin: Origin; rank: number; names: string[]; countries: string[]; codes: string[] };

const INDEX: Indexed[] = file.cities.map((city, rank) => ({
  origin: ORIGINS[rank],
  rank,
  names: [city.name, ...(city.aliases ?? [])].map(normalizeForSearch),
  countries: [ORIGINS[rank].countryTr, ...(COUNTRY_ALIASES[city.country] ?? [])].map(normalizeForSearch),
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

/** Cities matching a name (Turkish, English or local, any Turkish letters or none), a country or an IATA code. */
export function searchOrigins(query: string, limit = ORIGIN_RESULTS): OriginOption[] {
  const q = normalizeForSearch(query).slice(0, 60);
  if (!q) return ORIGINS.slice(0, limit).map(toOriginOption);
  const hits: Array<{ entry: Indexed; s: number }> = [];
  for (const entry of INDEX) {
    const s = score(entry, q);
    if (s !== null) hits.push({ entry, s });
  }
  return hits
    .sort((a, b) => a.s - b.s || a.entry.rank - b.entry.rank)
    .slice(0, limit)
    .map((h) => toOriginOption(h.entry.origin));
}

export const ORIGINS_COUNT = ORIGINS.length;
