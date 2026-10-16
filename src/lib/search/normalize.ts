import { DESTINATIONS, type Destination } from "@/data/destinations";

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
const COUNTRY_ALIASES: Record<string, readonly string[]> = {
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
  countries: [destination.countryTr, ...(COUNTRY_ALIASES[destination.countryCode] ?? [])].map(normalizeForSearch),
  codes: [destination.cityCode, ...destination.airports].map(normalizeForSearch),
}));

const collator = new Intl.Collator("tr");

function score(entry: Indexed, query: string): number | null {
  if (entry.codes.includes(query)) return 0;
  if (entry.names.some((n) => n.startsWith(query))) return 1;
  if (entry.countries.some((c) => c.startsWith(query))) return 2;
  const words = [...entry.names, ...entry.countries].flatMap((t) => t.split(" "));
  if (words.some((w) => w.startsWith(query))) return 3;
  // No mid-word matches: "ital" should not find "Brussels-Capital Region".
  return null;
}

/** Destinations matching a city name, country name or IATA code, best matches first. */
export function searchDestinations(query: string): Destination[] {
  const q = normalizeForSearch(query);
  if (!q) return [...DESTINATIONS].sort((a, b) => collator.compare(a.nameTr, b.nameTr));
  return INDEX.map((entry) => ({ entry, s: score(entry, q) }))
    .filter((r): r is { entry: Indexed; s: number } => r.s !== null)
    .sort((a, b) => a.s - b.s || collator.compare(a.entry.destination.nameTr, b.entry.destination.nameTr))
    .map((r) => r.entry.destination);
}
