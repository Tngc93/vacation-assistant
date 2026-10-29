import { cityName, countryName, DESTINATIONS, type Destination } from "@/data/destinations";
import type { Locale } from "@/i18n/locales";

/**
 * Folds text for search: Turkish-aware lowercase, no diacritics, dotless ı → i,
 * punctuation as spaces. "İSTANBUL", "Istanbul" and "istanbul" all become "istanbul".
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Everyday Turkish names for countries whose CLDR name differs (search only). */
export const COUNTRY_ALIASES: Record<string, readonly string[]> = {
  GB: ["İngiltere", "Britanya"],
  US: ["ABD", "Amerika"],
  AE: ["BAE", "Emirlikler"],
  KR: ["Kore"],
  CZ: ["Çek Cumhuriyeti"],
  NL: ["Holland"],
};

type Indexed = { destination: Destination; names: string[]; countries: string[]; codes: string[] };

const INDEX: Indexed[] = DESTINATIONS.map((destination) => ({
  destination,
  names: [destination.nameTr, destination.nameEn, ...(destination.aliases ?? [])].map(normalizeForSearch),
  countries: [
    destination.countryTr,
    countryName(destination, "en"),
    ...(COUNTRY_ALIASES[destination.countryCode] ?? []),
  ].map(normalizeForSearch),
  codes: [destination.cityCode, ...destination.airports].map(normalizeForSearch),
}));

const collators = { tr: new Intl.Collator("tr"), en: new Intl.Collator("en-GB") };

function score(entry: Indexed, query: string): number | null {
  if (entry.codes.includes(query)) return 0;
  if (entry.names.some((n) => n.startsWith(query))) return 1;
  if (entry.countries.some((c) => c.startsWith(query))) return 2;
  // Words are split on spaces and hyphens (normalizeForSearch turns hyphens into spaces).
  const words = [...entry.names, ...entry.countries].flatMap((t) => t.split(" "));
  if (words.some((w) => w.startsWith(query))) return 3;
  // Deliberately no mid-word (substring) matches: "ital" must not find "cap-ital".
  return null;
}

/**
 * Destinations matching a city name, country name (Turkish or English) or IATA code, best matches first; ties
 * in the interface language's alphabetical order of its city names.
 */
export function searchDestinations(query: string, locale: Locale = "tr"): Destination[] {
  const q = normalizeForSearch(query);
  const collator = collators[locale];
  const byName = (a: Destination, b: Destination) => collator.compare(cityName(a, locale), cityName(b, locale));
  if (!q) return [...DESTINATIONS].sort(byName);
  return INDEX.map((entry) => ({ entry, s: score(entry, q) }))
    .filter((r): r is { entry: Indexed; s: number } => r.s !== null)
    .sort((a, b) => a.s - b.s || byName(a.entry.destination, b.entry.destination))
    .map((r) => r.entry.destination);
}
