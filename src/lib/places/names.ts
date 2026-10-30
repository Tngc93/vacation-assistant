import { romanize } from "./romanize";

/**
 * Which name a reader sees, in Turkish and in English. A stored name in another script (Cyrillic, Japanese, Chinese, Arabic,
 * Greek…) is never the primary name when a Latin one exists; it stays as the small local name instead, like
 * "Güell Parkı · Park Güell". A name already in the Latin script is left as it is.
 */

/**
 * Wikidata labels of the place's item: Turkish and English when the stored name is not in the Latin script, the
 * English one otherwise when it differs from the stored name.
 */
export type WikidataLabels = { tr?: string; en?: string; enwiki?: string };
/** OSM name:en, name:latin (or a name:xx-Latn) and int_name, stored only when the stored name is not Latin. */
export type OsmLatinNames = { en?: string; latin?: string; int?: string };

/**
 * True when every letter is in the Latin script; digits, spaces, punctuation and letters of no script (Uzbek's
 * ʻ in "Oʻzbekiston") do not count.
 */
export const isLatin = (name: string): boolean => !/[^\P{L}\p{Script=Latin}\p{Script=Common}]/u.test(name);

/**
 * The primary name and the local name to show under it, for the Turkish interface. The order: Wikidata Turkish label, Wikidata English
 * label, OSM name:tr (already the stored name when OSM has one), name:en, name:latin, int_name, the OSM name.
 * Without a Latin alternative, the name romanized by the official system of the city's country (romanize/:
 * Cyrillic, Greek, Georgian, Hangul); else the local name stays primary (Japanese, Chinese, Arabic, Thai).
 */
type Named = {
  /** "wikidata/Q…" for a place only Wikidata has: its stored names are the item's Turkish and English labels. */
  id?: string;
  name: string;
  localName?: string;
  labels?: WikidataLabels;
  osmNames?: OsmLatinNames;
};

export function readableName(
  place: Named,
  countryCode?: string,
  locale: "tr" | "en" = "tr",
  placeWords: readonly string[] = [],
): { name: string; localName?: string } {
  if (locale === "en") return englishName(place, countryCode, placeWords);
  const own = { name: place.name, ...(place.localName ? { localName: place.localName } : {}) };
  if (isLatin(place.name)) return own;
  const { labels, osmNames } = place;
  const latin = [labels?.tr, labels?.en, osmNames?.en, osmNames?.latin, osmNames?.int]
    .map((n) => n?.trim())
    .find((n): n is string => Boolean(n) && isLatin(n!));
  const shown = latin ?? (countryCode ? romanize(place.name, countryCode) : undefined);
  return shown ? { name: shown, localName: place.name } : own;
}

/**
 * An English Wikipedia title as a name: without its disambiguation, "X (Barcelona)" → "X", and "Pantheon, Rome" →
 * "Pantheon" when what follows the comma is one of `placeWords` (the city's and its country's English names).
 */
export function wikipediaTitleName(title: string, placeWords: readonly string[] = []): string {
  const plain = title.replace(/\s+\([^()]*\)$/, "").trim();
  const comma = plain.lastIndexOf(", ");
  if (comma > 0) {
    const tail = plain.slice(comma + 2).toLowerCase();
    if (placeWords.some((w) => w.toLowerCase() === tail)) return plain.slice(0, comma).trim();
  }
  return plain;
}

/**
 * The name for the English interface: the English Wikipedia article's title (the name English readers use:
 * "Sagrada Família", "Colosseum"), then the Wikidata English label, then the local name in the Latin script (OSM's
 * own name, or its name:en, name:latin, int_name), else the local name romanized by the official system of the
 * city's country, else the local name. The local name stays under it when it differs ("Red Square · Красная
 * площадь", "Tokyo Tower · 東京タワー", "Park Güell" alone). A Turkish name is used only when nothing else exists.
 */
export function englishName(place: Named, countryCode?: string, placeWords: readonly string[] = []): { name: string; localName?: string } {
  // The local name: OSM's own `name`. A Wikidata-only place has none, only labels (its localName is the English one).
  const wikidataOnly = place.id?.startsWith("wikidata/") ?? false;
  const local = wikidataOnly ? (isLatin(place.name) ? undefined : place.name) : (place.localName ?? place.name);
  const { labels, osmNames } = place;
  const latin = [labels?.enwiki ? wikipediaTitleName(labels.enwiki, placeWords) : undefined, labels?.en, local, osmNames?.en, osmNames?.latin, osmNames?.int]
    .map((n) => n?.trim())
    .find((n): n is string => Boolean(n) && isLatin(n!));
  const original = local ?? place.name;
  const shown = latin ?? (countryCode && !isLatin(original) ? romanize(original, countryCode) : undefined) ?? (wikidataOnly ? (place.localName ?? place.name) : original);
  const under = local && local !== shown ? local : undefined;
  return { name: shown, ...(under ? { localName: under } : {}) };
}

/** OSM's Latin-script names from an element's tags; undefined when it has none. */
export function osmLatinNames(tags: Record<string, string>): OsmLatinNames | undefined {
  const latnKey = Object.keys(tags)
    .filter((k) => /^name:[a-z]{2,3}-Latn$/.test(k))
    .sort()[0];
  const names: OsmLatinNames = {};
  const en = tags["name:en"]?.trim();
  const latin = (tags["name:latin"] ?? (latnKey ? tags[latnKey] : undefined))?.trim();
  const int = tags.int_name?.trim();
  if (en) names.en = en;
  if (latin) names.latin = latin;
  if (int) names.int = int;
  return Object.keys(names).length ? names : undefined;
}
