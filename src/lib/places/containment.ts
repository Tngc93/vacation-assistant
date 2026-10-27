import { distanceKm } from "@/lib/geo";
import { externalFetch } from "@/lib/net";
import type { StoredPlace } from "./file";
import type { KindTag } from "./kinds";
import { KINDS_BATCH, sparql } from "./landmarks";
import type { Fetcher } from "./overpass";
import { isWalkThrough } from "./rules";

/**
 * A place inside another place of the same city (data script only): the Tsar Bell and the Tsar Cannon are in the
 * Moscow Kremlin, the Raphael Rooms in the Vatican Museums. Wikidata says so with P361 (part of) or P276
 * (location); the plan then visits the child with its parent, on the same day and right after it.
 *
 * Both properties are loose (the Eiffel Tower's location is the Champ de Mars, a museum branch is "part of" a
 * national museum across town), so an edge counts only when the parent is close, about as well known as the
 * child, and something one goes inside: not a street, road, square or bridge (rules.ts walk-throughs), not a
 * country.
 * One level only: a grandchild hangs on the top place, and a cycle (A in B, B in A) keeps the better-known one
 * as the parent.
 */

/** A child farther than this from its parent's point is not "inside" it (the Kremlin's Armoury is ~360 m off). */
export const PARENT_MAX_KM = 0.5;
/** The parent needs at least this share of the child's Wikipedia languages: not the Eiffel Tower in the Champ de Mars. */
export const PARENT_MIN_SHARE = 0.8;

/** Never a parent, besides the walk-throughs: a country (the Vatican), a road (Piccadilly), a river. */
const NOT_PARENTS: readonly KindTag[] = ["country", "road", "street", "waterline"];

/**
 * …nor an area: an old town, a district or a World Heritage listing of a whole centre (Gamla stan, the Medina of
 * Tunis, Florence's historic centre), unless it is also a building one visits (the Kremlin, Prague Castle, the
 * Acropolis). A child there is a sight of its own, not a sub-stop of a whole day's walk.
 */
const AREA: readonly KindTag[] = ["adminArea", "unesco"];
const VISITED: readonly KindTag[] = ["tower", "castle", "palace", "ruins", "museum", "religious", "attraction"];
const isArea = (p: StoredPlace) => {
  const kinds = (p.kinds ?? []) as KindTag[];
  return kinds.some((k) => AREA.includes(k)) && !kinds.some((k) => VISITED.includes(k));
};

export type ParentCandidate = { qid: string; sitelinks: number; trLabel?: string };

export function parentsQuery(qids: readonly string[]): string {
  return `SELECT ?item ?parent ?sitelinks ?tr WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ?item wdt:P361|wdt:P276 ?parent .
  ?parent wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?parent rdfs:label ?tr . FILTER(LANG(?tr) = "tr") }
}`;
}

type Binding = Record<string, { value: string } | undefined>;
const qidOf = (uri: string | undefined) => /Q[1-9]\d*$/.exec(uri ?? "")?.[0] ?? null;

/** child qid → its P361/P276 values with their sitelinks and Turkish label. */
export function parseParents(json: unknown): Map<string, ParentCandidate[]> {
  const rows = (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
  const out = new Map<string, ParentCandidate[]>();
  for (const b of rows) {
    const item = qidOf(b.item?.value);
    const parent = qidOf(b.parent?.value);
    const sitelinks = Number(b.sitelinks?.value);
    if (!item || !parent || item === parent || !Number.isFinite(sitelinks)) continue;
    const list = out.get(item) ?? [];
    if (list.some((c) => c.qid === parent)) continue;
    const tr = b.tr?.value.trim();
    list.push({ qid: parent, sitelinks, ...(tr ? { trLabel: tr } : {}) });
    out.set(item, list);
  }
  return out;
}

/** P361 and P276 of these items, in batches. Throws if any batch fails. */
export async function fetchParents(
  qids: readonly string[],
  { fetcher = externalFetch }: { fetcher?: Fetcher } = {},
): Promise<Map<string, ParentCandidate[]>> {
  const unique = [...new Set(qids)].filter((q) => /^Q[1-9]\d*$/.test(q)).sort();
  const parents = new Map<string, ParentCandidate[]>();
  for (let i = 0; i < unique.length; i += KINDS_BATCH) {
    for (const [item, list] of parseParents(await sparql(parentsQuery(unique.slice(i, i + KINDS_BATCH)), fetcher))) parents.set(item, list);
  }
  return parents;
}

const byQid = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Higher sitelinks first, then qid: a total order. */
const better = (a: ParentCandidate, b: ParentCandidate) => b.sitelinks - a.sitelinks || byQid(a.qid, b.qid);

/**
 * child qid → its parent (qid and the name to show: Turkish label, else the parent's stored name), among `places`
 * (the city's sights, museums and viewpoints, best ranked first; the first place of an item stands for it).
 */
export function chooseParents(
  places: readonly StoredPlace[],
  candidates: ReadonlyMap<string, readonly ParentCandidate[]>,
): Map<string, { parentId: string; parentName: string }> {
  const placeOf = new Map<string, StoredPlace>();
  for (const p of places) if (p.wikidataId && !placeOf.has(p.wikidataId)) placeOf.set(p.wikidataId, p);
  const near = (a: StoredPlace, b: StoredPlace) => distanceKm(a.lat, a.lon, b.lat, b.lon) <= PARENT_MAX_KM;

  // 1. Each child's best direct parent.
  const direct = new Map<string, ParentCandidate>();
  for (const [child, list] of [...candidates].sort(([a], [b]) => byQid(a, b))) {
    const c = placeOf.get(child);
    if (!c) continue;
    const ok = list.filter((cand) => {
      const p = placeOf.get(cand.qid);
      if (!p || cand.qid === child) return false;
      if ((p.kinds ?? []).some((k) => NOT_PARENTS.includes(k as KindTag)) || isWalkThrough(p) || isArea(p)) return false;
      if ((p.wikipediaCount ?? 0) < PARENT_MIN_SHARE * (c.wikipediaCount ?? 0)) return false;
      return near(c, p);
    });
    const best = [...ok].sort(better)[0];
    if (best) direct.set(child, best);
  }

  // 2. Cycles: each component of this one-parent graph has at most one; its best-known member becomes a top place.
  const sitelinksOf = (q: string) => [...direct.values()].find((d) => d.qid === q)?.sitelinks ?? 0;
  for (const start of [...direct.keys()].sort(byQid)) {
    const path: string[] = [];
    let q: string | undefined = start;
    while (q && direct.has(q) && !path.includes(q)) {
      path.push(q);
      q = direct.get(q)!.qid;
    }
    if (q && path.includes(q)) {
      const cycle = path.slice(path.indexOf(q));
      const top = [...cycle].sort((a, b) => sitelinksOf(b) - sitelinksOf(a) || byQid(a, b))[0];
      direct.delete(top);
    }
  }

  // 3. One level: a child of a child hangs on the top place, if that is still close.
  const out = new Map<string, { parentId: string; parentName: string }>();
  for (const child of direct.keys()) {
    let top = direct.get(child)!;
    while (direct.has(top.qid)) top = direct.get(top.qid)!;
    const c = placeOf.get(child)!;
    const p = placeOf.get(top.qid)!;
    if (!near(c, p)) continue;
    out.set(child, { parentId: top.qid, parentName: top.trLabel ?? p.name });
  }
  return out;
}
