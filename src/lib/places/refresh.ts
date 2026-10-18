import type { CityOverrides } from "@/data/place-overrides";
import { distanceKm } from "@/lib/geo";
import { CATEGORIES, type CategoryId } from "./categories";
import type { PlacesFile, StoredPlace } from "./file";
import { linkTags, type KindTag } from "./kinds";
import { fetchCoordinates, fetchKinds } from "./landmarks";
import type { Fetcher } from "./overpass";
import { compareRanked } from "./rank";
import { sameNameOnce } from "./twins";
import { fetchWikipediaCounts } from "./wikidata";

/**
 * Brings a stored file's Wikidata facts up to date without Overpass (data script only): applies the relink
 * overrides (the right item's Wikipedia count; a Wikidata-only copy of that item goes, the OSM object is it),
 * then stores every sight's kinds and, for OSM objects, whether their item has a coordinate near them.
 */
export async function refreshKinds(
  file: PlacesFile,
  overrides: CityOverrides,
  { fetcher, kinds: known }: { fetcher?: Fetcher; kinds?: ReadonlyMap<string, readonly KindTag[]> } = {},
): Promise<{ file: PlacesFile; relinked: string[]; missing: string[] }> {
  const ids = (Object.keys(file.categories) as CategoryId[]).filter((c) => CATEGORIES[c].ranking === "wikipedia");
  const categories = structuredClone(file.categories);
  const placesOf = (c: CategoryId) => {
    const entry = categories[c];
    return entry.status === "ok" ? entry.places : [];
  };

  // 1. Relinks.
  const relinks = overrides.relink ?? [];
  const relinked: string[] = [];
  const missing: string[] = [];
  const counts = relinks.length ? await fetchWikipediaCounts(relinks.map((r) => r.qid), { fetcher }) : new Map<string, number>();
  for (const r of relinks) {
    const place = ids.flatMap(placesOf).find((p) => p.id === r.osmId && (p.wikidataId === r.from || p.wikidataId === r.qid));
    if (!place) {
      missing.push(r.osmId);
      continue;
    }
    place.wikidataId = r.qid;
    const count = counts.get(r.qid);
    if (count) place.wikipediaCount = count;
    else delete place.wikipediaCount;
    relinked.push(r.osmId);
    for (const c of ids) {
      const entry = categories[c];
      if (entry.status === "ok") entry.places = entry.places.filter((p) => p.id !== `wikidata/${r.qid}`);
    }
  }

  // 2. Kinds and link tags.
  const qids = ids.flatMap(placesOf).flatMap((p) => p.wikidataId ?? []);
  // Kinds the caller already has are reused; the rest (all of them, or a relink's new item) are asked for.
  const kinds = new Map<string, readonly KindTag[]>(known ?? []);
  const unknown = qids.filter((q) => !kinds.has(q));
  if (unknown.length) for (const [q, tags] of await fetchKinds(unknown, { fetcher })) kinds.set(q, tags);
  const coords = await fetchCoordinates(qids, { fetcher });
  for (const c of ids) {
    const entry = categories[c];
    if (entry.status !== "ok") continue;
    entry.places = entry.places
      .map((p): StoredPlace => {
        const { kinds: _old, ...rest } = p;
        if (!p.wikidataId) return rest;
        const tags = [...new Set([...(kinds.get(p.wikidataId) ?? []), ...linkTags(p, coords.get(p.wikidataId), distanceKm)])].sort();
        return tags.length ? { ...rest, kinds: tags as KindTag[] } : rest;
      })
      .sort(compareRanked);
    // A relink can make two objects the same item (Big Ben and Elizabeth Tower): keep it once, at its best rank.
    entry.places = sameNameOnce(entry.places);
  }
  return { file: { ...file, categories }, relinked, missing };
}
