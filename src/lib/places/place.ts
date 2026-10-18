import { classify, isCocktailBar, type CategoryId } from "./categories";
import type { KindTag } from "./kinds";
import type { OverpassElement } from "./overpass";

export type Place = {
  /** "node/123", "way/456" — stable OSM identity. */
  id: string;
  category: CategoryId;
  /** Turkish name when OSM has one, otherwise the local name. */
  name: string;
  /** Local name when it differs from `name`. */
  localName?: string;
  lat: number;
  lon: number;
  /** Street address or neighbourhood, whichever is available. */
  address?: string;
  website?: string;
  openingHours?: string;
  cuisine?: string;
  wikidataId?: string;
  /** ISO country code when the place is not in the destination's country (the Vatican from Rome). */
  country?: string;
  /** Wikidata kinds (kinds.ts), filled in by the data script for sights, museums and viewpoints. */
  kinds?: KindTag[];
};

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function shortAddress(tags: Record<string, string>): string | undefined {
  const street = tags["addr:street"];
  if (street) return [street, tags["addr:housenumber"]].filter(Boolean).join(" ");
  return tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? tags["addr:quarter"] ?? tags["addr:district"];
}

/** Turns an Overpass element into a Place for `category`, or null if it does not belong there. */
export function toPlace(element: OverpassElement, category: CategoryId): Place | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const local = tags.name?.trim();
  if (!local || lat === undefined || lon === undefined) return null;
  if (!classify(tags).includes(category)) return null;
  // "Bar ve pub" never shows bars tagged for cocktails.
  if (category === "pub" && isCocktailBar(tags)) return null;

  const turkish = tags["name:tr"]?.trim();
  const qid = tags.wikidata?.trim();
  return {
    id: `${element.type}/${element.id}`,
    category,
    name: turkish || local,
    ...(turkish && turkish !== local ? { localName: local } : {}),
    lat,
    lon,
    ...(shortAddress(tags) ? { address: shortAddress(tags) } : {}),
    ...(safeUrl(tags.website ?? tags["contact:website"]) ? { website: safeUrl(tags.website ?? tags["contact:website"]) } : {}),
    ...(tags.opening_hours ? { openingHours: tags.opening_hours } : {}),
    ...(tags.cuisine ? { cuisine: tags.cuisine.replace(/_/g, " ").replace(/;/g, ", ") } : {}),
    ...(qid && /^Q[1-9]\d*$/.test(qid) ? { wikidataId: qid } : {}),
  };
}
