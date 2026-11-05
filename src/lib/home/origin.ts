/**
 * Where the home page's routes start: the departure city this browser remembers (`va.origin`), else İstanbul.
 *
 * The departure list (src/data/origins.json) stays on the server and carries no coordinates, so the browser knows a
 * remembered city's position only when it is one of our 68 destinations (src/data/destinations.ts, already in the
 * client bundle: London, Paris, Berlin…). Any other city (Ankara, Chicago) starts from İstanbul: the routes are a
 * decoration, and an extra request or a coordinate list in the bundle would cost more than the picture is worth.
 */
import { findDestination } from "@/data/destinations";
import { DEFAULT_ORIGIN, type OriginOption } from "@/data/origins";
import type { Place } from "./routes";

/** İstanbul's Wikidata coordinate (Q406, P625: 41°00′49″N 28°57′18″E). */
export const ISTANBUL: Place = { code: DEFAULT_ORIGIN, lat: 41.0136, lon: 28.955 };

export function homeOrigin(remembered: Pick<OriginOption, "code"> | null): Place {
  const city = remembered && remembered.code !== DEFAULT_ORIGIN ? findDestination(remembered.code) : undefined;
  return city ? { code: city.cityCode, lat: city.lat, lon: city.lon } : ISTANBUL;
}
