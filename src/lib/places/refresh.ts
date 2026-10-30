import type { CityOverrides } from "@/data/place-overrides";
import { distanceKm } from "@/lib/geo";
import { CATEGORIES, type CategoryId } from "./categories";
import { mergeCocktailBars, type CocktailBar } from "./cocktails";
import { chooseParents, fetchParents } from "./containment";
import type { PlacesFile, StoredPlace } from "./file";
import { linkTags, type KindTag } from "./kinds";
import { fetchCoordinates, fetchKinds } from "./landmarks";
import { isLatin } from "./names";
import type { Fetcher } from "./overpass";
import { compareRanked } from "./rank";
import { sameNameOnce } from "./twins";
import { fetchEntitySummaries, fetchWikipediaCounts, type EntitySummary } from "./wikidata";

/**
 * Brings a stored file's Wikidata facts up to date without Overpass (data script only): applies the relink
 * overrides (the right item's Wikipedia count; a Wikidata-only copy of that item goes, the OSM object is it),
 * adds included places the file does not have (the Atomium, beyond the city radius) from Wikidata, then
 * stores every sight's kinds and, for OSM objects, whether their item has a coordinate near them. A place
 * whose name is not in the Latin script keeps its item's Turkish and English labels, every other item its English
 * label when it differs (names.ts, `refreshLabels`). Given the city's
 * Wikidata cocktail bars, it joins them to the stored bars and pubs (cocktails.ts).
 */
export async function refreshKinds(
  file: PlacesFile,
  overrides: CityOverrides,
  {
    fetcher,
    kinds: known,
    cocktailBars,
  }: {
    fetcher?: Fetcher;
    kinds?: ReadonlyMap<string, readonly KindTag[]>;
    /** The Wikidata cocktail bars within the city's radius (cocktails.ts barsNear); left as they are when absent. */
    cocktailBars?: readonly CocktailBar[];
  } = {},
): Promise<{ file: PlacesFile; relinked: string[]; added: string[]; missing: string[]; cocktails: { matched: string[]; added: string[] } }> {
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

  // 1b. Included places the file does not have, as Wikidata places among the sights.
  const added: string[] = [];
  const have = new Set(ids.flatMap(placesOf).flatMap((p) => p.wikidataId ?? []));
  const absent = (overrides.include ?? []).map((o) => o.qid).filter((q) => !have.has(q));
  const see = categories.see;
  if (absent.length && see.status === "ok") {
    const summaries = await fetchEntitySummaries(absent, { fetcher });
    const at = await fetchCoordinates(absent, { fetcher });
    for (const qid of absent) {
      const info = summaries.get(qid);
      const point = at.get(qid)?.[0];
      const name = info?.tr ?? info?.en;
      if (!info || !point || !name) {
        missing.push(qid);
        continue;
      }
      see.places.push({
        id: `wikidata/${qid}`,
        name,
        ...(info.en && info.en !== name ? { localName: info.en } : {}),
        lat: Number(point.lat.toFixed(5)),
        lon: Number(point.lon.toFixed(5)),
        ...(info.wikipedias ? { wikipediaCount: info.wikipedias } : {}),
        wikidataId: qid,
      });
      added.push(qid);
    }
  }

  // 1c. Wikidata cocktail bars: matched bars and pubs move to the cocktail bars, the rest are added.
  const cocktails = { matched: [] as string[], added: [] as string[] };
  const cocktail = categories.cocktail;
  const pub = categories.pub;
  if (cocktailBars && cocktail?.status === "ok" && pub?.status === "ok") {
    const merged = mergeCocktailBars({ cocktail: cocktail.places, pub: pub.places }, cocktailBars);
    cocktail.places = merged.cocktail;
    pub.places = merged.pub;
    cocktails.matched = merged.matched;
    cocktails.added = merged.added;
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

  // 3. The place each one is inside (P361/P276), among this city's places (containment.ts).
  const parents = chooseParents(ids.flatMap(placesOf), await fetchParents(qids, { fetcher }));
  for (const c of ids) {
    const entry = categories[c];
    if (entry.status !== "ok") continue;
    entry.places = entry.places.map((p): StoredPlace => {
      const { parentId: _id, parentName: _name, ...rest } = p;
      const parent = p.wikidataId ? parents.get(p.wikidataId) : undefined;
      return parent ? { ...rest, ...parent } : rest;
    });
  }
  const labelled = await refreshLabels({ ...file, categories }, { fetcher });
    return { file: labelled, relinked, added, missing, cocktails };
}

/**
 * The Wikidata labels a place keeps (names.ts), in every category: the Turkish and English ones of a name in another
 * script ("東京タワー" → "Tokyo Kulesi", "Tokyo Tower"), and the English one of every other item when it differs from
 * the stored name, for the English interface ("Güell Parkı" → "Park Güell"); and the item's English Wikipedia title
 * when it differs from both ("Sagrada Família", where the label is "Basilica and Expiatory Church of the Holy Family"). Alone, it is `npm run data:kinds --
 * --labels`: nothing else in the file changes.
 */
export async function refreshLabels(file: PlacesFile, { fetcher }: { fetcher?: Fetcher } = {}): Promise<PlacesFile> {
  const categories = structuredClone(file.categories);
  const all = Object.keys(categories) as CategoryId[];
  const placesOf = (c: CategoryId) => {
    const entry = categories[c];
    return entry.status === "ok" ? entry.places : [];
  };
  const qids = [...new Set(all.flatMap(placesOf).flatMap((p) => p.wikidataId ?? []))];
  const labelsOf = qids.length ? await fetchEntitySummaries(qids, { fetcher }) : new Map<string, EntitySummary>();
  for (const c of all) {
    const entry = categories[c];
    if (entry.status !== "ok") continue;
    entry.places = entry.places.map((p): StoredPlace => {
      const { labels: _labels, ...rest } = p;
      const info = p.wikidataId ? labelsOf.get(p.wikidataId) : undefined;
      const foreign = !isLatin(p.name);
      const labels = {
        ...(foreign && info?.tr ? { tr: info.tr } : {}),
        ...(info?.en && (foreign || info.en !== p.name) ? { en: info.en } : {}),
        // The English article's title, the name English readers know ("Sagrada Família", "Colosseum").
        ...(info?.enwiki && info.enwiki !== p.name && info.enwiki !== info.en ? { enwiki: info.enwiki } : {}),
      };
      return Object.keys(labels).length ? { ...rest, labels } : rest;
    });
  }
  return { ...file, categories };
}
