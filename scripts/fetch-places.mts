/**
 * Fetches place data for every destination and writes src/data/places/<CODE>.json.
 * Run with `npm run data:places` (optionally followed by city codes: `-- BCN SJJ`).
 *
 * Polite by design: one Overpass query per city (all categories), strictly
 * one request at a time, a pause between cities and growing back-off after
 * failures or HTTP 429. If the per-city query keeps failing, categories are
 * tried one by one; whatever still fails is stored as "missing".
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS, type Destination } from "../src/data/destinations";
import { fetchCityPhoto } from "../src/lib/city/photo";
import { buildCategoryEntry } from "../src/lib/places/build";
import { CATEGORY_IDS } from "../src/lib/places/categories";
import { ODBL, PLACES_FILE_VERSION, placesFileSchema, SOURCES, type PlacesFile } from "../src/lib/places/file";
import { buildCityQuery, buildOverpassQuery, runOverpass, type OverpassElement } from "../src/lib/places/overpass";

const OUT_DIR = path.join(import.meta.dirname, "..", "src", "data", "places");
const PAUSE_BETWEEN_CITIES_MS = 5_000;
const BACKOFF_MS = [30_000, 60_000, 120_000];

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

  for (const category of CATEGORY_IDS) {
    try {
      const elements =
        cityElements ??
        (await withBackoff(`${city.cityCode}/${category} overpass`, () =>
          runOverpass(buildOverpassQuery(category, city.lat, city.lon, city.radiusKm)),
        ));
      const { places, wikipediaCountsAvailable } = await buildCategoryEntry(city, category, elements, {
        retry: withBackoff,
      });
      categories[category] = { status: "ok", wikipediaCountsAvailable, places };
    } catch (error) {
      categories[category] = { status: "missing", reason: (error as Error).message.slice(0, 200) };
    }
  }

  let photo: PlacesFile["photo"] = null;
  try {
    photo = await withBackoff(`${city.cityCode} photo`, () => fetchCityPhoto(city.wikidataId));
  } catch {
    photo = null;
  }

  return placesFileSchema.parse({
    version: PLACES_FILE_VERSION,
    cityCode: city.cityCode,
    fetchedAt: new Date().toISOString(),
    radiusKm: city.radiusKm,
    license: ODBL,
    sources: SOURCES,
    photo,
    categories,
  });
}

const wanted = new Set(process.argv.slice(2).map((c) => c.toUpperCase()));
const cities = DESTINATIONS.filter((d) => wanted.size === 0 || wanted.has(d.cityCode));
mkdirSync(OUT_DIR, { recursive: true });

let missing = 0;
for (const [index, city] of cities.entries()) {
  log(`[${index + 1}/${cities.length}] ${city.cityCode} ${city.nameTr}`);
  const file = await fetchCity(city);
  writeFileSync(path.join(OUT_DIR, `${city.cityCode}.json`), `${JSON.stringify(file, null, 1)}\n`);
  const summary = CATEGORY_IDS.map((c) => {
    const entry = file.categories[c];
    if (entry.status === "missing") missing++;
    return `${c}:${entry.status === "ok" ? entry.places.length : "–"}`;
  }).join(" ");
  log(`  wrote ${city.cityCode}.json ${summary} photo:${file.photo ? "yes" : "no"}`);
  if (index < cities.length - 1) await sleep(PAUSE_BETWEEN_CITIES_MS);
}
log(`done: ${cities.length} cities, ${missing} missing categories`);
