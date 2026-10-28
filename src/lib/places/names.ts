import { romanize } from "./romanize";

/**
 * Which name a Turkish reader sees. A stored name in another script (Cyrillic, Japanese, Chinese, Arabic,
 * Greek…) is never the primary name when a Latin one exists; it stays as the small local name instead, like
 * "Güell Parkı · Park Güell". A name already in the Latin script is left as it is.
 */

/** Wikidata labels of the place's item, stored only when the stored name is not in the Latin script. */
export type WikidataLabels = { tr?: string; en?: string };
/** OSM name:en, name:latin (or a name:xx-Latn) and int_name, stored only when the stored name is not Latin. */
export type OsmLatinNames = { en?: string; latin?: string; int?: string };

/**
 * True when every letter is in the Latin script; digits, spaces, punctuation and letters of no script (Uzbek's
 * ʻ in "Oʻzbekiston") do not count.
 */
export const isLatin = (name: string): boolean => !/[^\P{L}\p{Script=Latin}\p{Script=Common}]/u.test(name);

/**
 * The primary name and the local name to show under it. The order: Wikidata Turkish label, Wikidata English
 * label, OSM name:tr (already the stored name when OSM has one), name:en, name:latin, int_name, the OSM name.
 * Without a Latin alternative, the name romanized by the official system of the city's country (romanize/:
 * Cyrillic, Greek, Georgian, Hangul); else the local name stays primary (Japanese, Chinese, Arabic, Thai).
 */
export function readableName(
  place: {
    name: string;
    localName?: string;
    labels?: WikidataLabels;
    osmNames?: OsmLatinNames;
  },
  countryCode?: string,
): { name: string; localName?: string } {
  const own = { name: place.name, ...(place.localName ? { localName: place.localName } : {}) };
  if (isLatin(place.name)) return own;
  const { labels, osmNames } = place;
  const latin = [labels?.tr, labels?.en, osmNames?.en, osmNames?.latin, osmNames?.int]
    .map((n) => n?.trim())
    .find((n): n is string => Boolean(n) && isLatin(n!));
  const shown = latin ?? (countryCode ? romanize(place.name, countryCode) : undefined);
  return shown ? { name: shown, localName: place.name } : own;
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
