import { distanceKm } from "@/lib/geo";

/** A child dot closer than this to its parent's would sit under it at street zoom (the Tsar Cannon is 18 m off). */
export const SPREAD_MIN_KM = 0.035;
/** …so it is drawn this far from the parent, in its own direction (or around the parent when on top of it). */
export const SPREAD_KM = 0.04;

type Spot = { id: string; lat: number; lon: number; wikidataId?: string; parentId?: string };

/**
 * Map positions for places inside another listed place (containment.ts): a child right on its parent's point is
 * moved a little away from it, so the two dots never cover each other. Display only; other places keep theirs.
 */
export function spreadInside<T extends Spot>(places: readonly T[]): T[] {
  const parents = new Map<string, Spot>();
  for (const p of places) if (p.wikidataId && !parents.has(p.wikidataId)) parents.set(p.wikidataId, p);
  const order = new Map<string, number>();
  return places.map((p) => {
    const parent = p.parentId ? parents.get(p.parentId) : undefined;
    if (!parent || parent.id === p.id) return p;
    const km = distanceKm(parent.lat, parent.lon, p.lat, p.lon);
    if (km >= SPREAD_MIN_KM) return p;
    const n = order.get(parent.id) ?? 0;
    order.set(parent.id, n + 1);
    const kx = Math.cos((parent.lat * Math.PI) / 180);
    // Its own direction from the parent; on top of it, the golden angle spreads the children evenly around it.
    const angle = km > 0.002 ? Math.atan2(p.lat - parent.lat, (p.lon - parent.lon) * kx) : n * 2.39996;
    const deg = SPREAD_KM / 111.32;
    return { ...p, lat: parent.lat + deg * Math.sin(angle), lon: parent.lon + (deg * Math.cos(angle)) / kx };
  });
}
