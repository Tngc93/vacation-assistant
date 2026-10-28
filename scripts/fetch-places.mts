/**
 * Fetches place data for every destination and writes src/data/places/<CODE>.json.
 * Run with `npm run data:places` (optionally followed by city codes: `-- BCN SJJ`).
 *
 * Resumable: a city whose file was written by this file version in the last
 * 24 hours is skipped, so an interrupted run picks up where it stopped. Pass
 * `--force` (`npm run data:places -- --force`) to fetch every city again.
 *
 * Polite by design: one Overpass query per city (all categories), strictly
 * one request at a time, a pause between cities and growing back-off after
 * failures or HTTP 429. If the per-city query keeps failing, categories are
 * tried one by one; whatever still fails is stored as "missing".
 *
 * Must-see places come from the Wikidata Query Service too (two small SPARQL
 * queries per city, see landmarks.ts) and are merged into sights and museums.
 * One more query stores each sight's Wikidata kinds (kinds.ts) and whether an
 * OSM object's item has a coordinate near it (refresh.ts); which places
 * count as sights is decided when the files are read (rules.ts), so a rule
 * change needs no refetch. Places with a Wikidata item get a card photo
 * (P18, licence-filtered like the city photo) and a short description
 * (photos.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cityCentre, DESTINATIONS, type Destination } from "../src/data/destinations";
import { fetchCityPhoto } from "../src/lib/city/photo";
import { buildCategoryEntry, mergeLandmarks, type LandmarkMerge } from "../src/lib/places/build";
import { CATEGORY_IDS, type CategoryId } from "../src/lib/places/categories";
import { PLACE_OVERRIDES } from "../src/data/place-overrides";
import type { KindTag } from "../src/lib/places/kinds";
import { fetchKinds, fetchLandmarks } from "../src/lib/places/landmarks";
import { addPhotosAndDescriptions } from "../src/lib/places/photos";
import { refreshKinds } from "../src/lib/places/refresh";
import { isSight } from "../src/lib/places/rules";
import { toPlace } from "../src/lib/places/place";
import { ODBL, PLACES_FILE_VERSION, placesFileSchema, SOURCES, type PlacesFile } from "../src/lib/places/file";
import { buildCityQuery, buildOverpassQuery, runOverpass, type OverpassElement } from "../src/lib/places/overpass";

const OUT_DIR = path.join(import.meta.dirname, "..", "src", "data", "places");
const PAUSE_BETWEEN_CITIES_MS = 5_000;
const BACKOFF_MS = [30_000, 60_000, 120_000];
/** A file this recent, written by the current file version, is not fetched again (unless --force). */
const FRESH_MS = 24 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

/** Runs `task`, waiting longer after each failure (longest after HTTP 429). */
async function withBackoff<T>(label: string, task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const message = (error as Error).message;
      if (attempt >= BACKOFF_MS.length) throw error;
      const wait = BACKOFF_MS[attempt] * (message.includes("429") ? 2 : 1);
      log(`  ${label} failed (${message.slice(0, 120)}), retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

const DAYTIME: readonly CategoryId[] = ["see", "museum", "viewpoint"];
/** Landmarks added from Wikidata (not in OSM), per city, for the run summary. */
const addedFromWikidata = new Map<string, number>();
/** Cities not written this run (their old file stays; a rerun fetches them again). */
const failed: string[] = [];

async function fetchCity(city: Destination): Promise<PlacesFile> {
  const categories = {} as PlacesFile["categories"];

  let cityElements: OverpassElement[] | null = null;
  try {
    cityElements = await withBackoff(`${city.cityCode} overpass`, () =>
      runOverpass(buildCityQuery(city.lat, city.lon, city.radiusKm), { timeoutMs: 150_000 }),
    );
  } catch (error) {
    log(`  ${city.cityCode}: city query failed, trying categories one by one`, (error as Error).message.slice(0, 120));
  }

  const elementsBy = new Map<CategoryId, OverpassElement[] | Error>();
  for (const category of CATEGORY_IDS) {
    try {
      elementsBy.set(
        category,
        cityElements ??
          (await withBackoff(`${city.cityCode}/${category} overpass`, () =>
            runOverpass(buildOverpassQuery(category, city.lat, city.lon, city.radiusKm)),
          )),
      );
    } catch (error) {
      elementsBy.set(category, error as Error);
    }
  }

  // Must-see places from Wikidata, joined to the OSM sights, museums and viewpoints.
  let landmarks: LandmarkMerge | undefined;
  try {
    const found = await withBackoff(`${city.cityCode} landmarks`, () => fetchLandmarks(city));
    const osm = DAYTIME.flatMap((category) => {
      const elements = elementsBy.get(category);
      return Array.isArray(elements) ? elements.map((e) => toPlace(e, category)).filter((p) => p !== null) : [];
    });
    landmarks = mergeLandmarks(osm, found, city.countryCode);
    log(`  ${city.cityCode}: ${found.length} Wikidata landmarks, ${landmarks.qidFor.size} matched by name, ${landmarks.extras.length} added`);
  } catch (error) {
    log(`  ${city.cityCode}: landmarks failed, OSM only`, (error as Error).message.slice(0, 120));
  }

  // Kinds of every sight (the read-time rules use them: music venues, stations, streets…).
  let kinds: Map<string, KindTag[]> | undefined;
  const qids = DAYTIME.flatMap((category) => {
    const elements = elementsBy.get(category);
    return Array.isArray(elements) ? elements.flatMap((e) => toPlace(e, category)?.wikidataId ?? []) : [];
  });
  qids.push(...(landmarks ? [...landmarks.qidFor.values(), ...landmarks.extras.flatMap((p) => p.wikidataId ?? [])] : []));
  try {
    kinds = await withBackoff(`${city.cityCode} kinds`, () => fetchKinds(qids));
    log(`  ${city.cityCode}: kinds for ${kinds.size} of ${new Set(qids).size} Wikidata items`);
  } catch (error) {
    // Without kinds the rules cannot tell a club from a sight: keep the old file, a rerun fetches the city again.
    throw new Error(`kinds failed (${(error as Error).message.slice(0, 120)})`);
  }
  const overrides = PLACE_OVERRIDES[city.cityCode] ?? {};

  for (const category of CATEGORY_IDS) {
    const elements = elementsBy.get(category)!;
    if (elements instanceof Error) {
      categories[category] = { status: "missing", reason: elements.message.slice(0, 200) };
      continue;
    }
    try {
      const { places, wikipediaCountsAvailable } = await buildCategoryEntry(city, category, elements, {
        retry: withBackoff,
        landmarks,
        kinds,
        overrides,
      });
      categories[category] = { status: "ok", wikipediaCountsAvailable, places };
    } catch (error) {
      categories[category] = { status: "missing", reason: (error as Error).message.slice(0, 200) };
    }
  }
  const kept = new Set(
    (["see", "museum"] as const).flatMap((c) => {
      const entry = categories[c];
      return entry.status === "ok"
        ? entry.places.filter((p) => p.id.startsWith("wikidata/") && isSight(p, c, overrides)).map((p) => p.id)
        : [];
    }),
  );
  addedFromWikidata.set(city.cityCode, kept.size);

  let photo: PlacesFile["photo"] = null;
  try {
    photo = await withBackoff(`${city.cityCode} photo`, () => fetchCityPhoto(city.wikidataId));
  } catch {
    photo = null;
  }

  const built = placesFileSchema.parse({
    version: PLACES_FILE_VERSION,
    cityCode: city.cityCode,
    fetchedAt: new Date().toISOString(),
    radiusKm: city.radiusKm,
    license: ODBL,
    sources: SOURCES,
    photo,
    categories,
  });
  // Relink overrides and link tags (an item without a coordinate near the OSM object), as `npm run data:kinds` does.
  const refreshed = await withBackoff(`${city.cityCode} refresh`, () => refreshKinds(built, overrides, { kinds }));
  if (refreshed.missing.length) log(`  ${city.cityCode}: override not found for ${refreshed.missing.join(" ")}`);
  // Card photos and descriptions: nice to have, so a failure leaves the city without them rather than unwritten.
  try {
    return placesFileSchema.parse(await withBackoff(`${city.cityCode} photos`, () => addPhotosAndDescriptions(refreshed.file)));
  } catch (error) {
    log(`  ${city.cityCode}: photos and descriptions failed, written without them`, (error as Error).message.slice(0, 120));
    return placesFileSchema.parse(refreshed.file);
  }
}

/** True when the city's file was written by this file version within the last 24 hours. */
function isFresh(code: string, now: number): boolean {
  const file = path.join(OUT_DIR, `${code}.json`);
  if (!existsSync(file)) return false;
  try {
    const parsed = placesFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success && now - Date.parse(parsed.data.fetchedAt) < FRESH_MS;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const wanted = new Set(args.filter((a) => !a.startsWith("--")).map((c) => c.toUpperCase()));
const cities = DESTINATIONS.filter((d) => wanted.size === 0 || wanted.has(d.cityCode));
mkdirSync(OUT_DIR, { recursive: true });

let missing = 0;
let skipped = 0;
for (const [index, city] of cities.entries()) {
  if (!force && isFresh(city.cityCode, Date.now())) {
    skipped++;
    log(`[${index + 1}/${cities.length}] ${city.cityCode} fetched in the last 24 hours, skipped (--force to fetch again)`);
    continue;
  }
  log(`[${index + 1}/${cities.length}] ${city.cityCode} ${city.nameTr}`);
  let file: PlacesFile;
  try {
    // Fetched around the tourist centre (Nihonbashi for Tokyo), the one the guide and "far from the centre" use.
    file = await fetchCity({ ...city, ...cityCentre(city) });
  } catch (error) {
    failed.push(city.cityCode);
    log(`  ${city.cityCode} not written: ${(error as Error).message}`);
    continue;
  }
  writeFileSync(path.join(OUT_DIR, `${city.cityCode}.json`), `${JSON.stringify(file, null, 1)}\n`);
  const summary = CATEGORY_IDS.map((c) => {
    const entry = file.categories[c];
    if (entry.status === "missing") missing++;
    return `${c}:${entry.status === "ok" ? entry.places.length : "–"}`;
  }).join(" ");
  const stored = CATEGORY_IDS.flatMap((c) => (file.categories[c].status === "ok" ? (file.categories[c] as { places: { photo?: unknown }[] }).places : []));
  log(`  wrote ${city.cityCode}.json ${summary} photo:${file.photo ? "yes" : "no"} card photos:${stored.filter((p) => p.photo).length}/${stored.length}`);
  if (index < cities.length - 1) await sleep(PAUSE_BETWEEN_CITIES_MS);
}
const added = [...addedFromWikidata.values()].reduce((a, b) => a + b, 0);
log(
  `done: ${cities.length - skipped - failed.length} cities fetched, ${skipped} skipped, ${failed.length} failed, ${missing} missing categories, ` +
    `${added} places added from Wikidata (not in OSM, shown as sights) in the fetched cities`,
);
if (failed.length) log(`not written: ${failed.join(" ")} — run the same command again to fetch them`);
