/**
 * Refreshes the Wikidata facts of the stored place files without Overpass: applies the relink overrides
 * (src/data/place-overrides.ts), stores every sight's kinds and link tags (src/lib/places/refresh.ts), and
 * the card photos and descriptions (src/lib/places/photos.ts), and the place each one is inside
 * (src/lib/places/containment.ts), and the Wikidata cocktail bars, joined to the stored bars and pubs
 * (src/lib/places/cocktails.ts; one WDQS query for every city).
 * Run with `npm run data:kinds` (optionally `-- NYC DUB`); a few minutes for all cities, one city at a time.
 * `-- --labels` adds only the English labels and descriptions (refreshLabels, addEnglishDescriptions) and changes
 * nothing else.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cityCentre, findDestination } from "../src/data/destinations";
import { PLACE_OVERRIDES } from "../src/data/place-overrides";
import { barsNear, fetchCocktailBars } from "../src/lib/places/cocktails";
import { PLACES_FILE_VERSION, placesFileSchema } from "../src/lib/places/file";
import { addEnglishDescriptions, addPhotosAndDescriptions } from "../src/lib/places/photos";
import { refreshKinds, refreshLabels } from "../src/lib/places/refresh";

const DIR = path.join(import.meta.dirname, "..", "src", "data", "places");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const args = process.argv.slice(2);
const labelsOnly = args.includes("--labels");
const wanted = new Set(args.filter((a) => !a.startsWith("--")).map((c) => c.toUpperCase()));
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (wanted.size === 0 || wanted.has(f.slice(0, 3)))).sort();
const failed: string[] = [];
const cocktailBars = labelsOnly ? [] : await fetchCocktailBars();
if (!labelsOnly) log(`${cocktailBars.length} cocktail bars on Wikidata`);
for (const name of files) {
  // An older file version is brought up to this one: everything a version added comes from Wikidata, refreshed here.
  const raw = JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as Record<string, unknown>;
  const file = placesFileSchema.parse({ ...raw, version: PLACES_FILE_VERSION });
  let result: Awaited<ReturnType<typeof refreshKinds>> | undefined;
  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    try {
      if (labelsOnly) {
        result = { file: await addEnglishDescriptions(await refreshLabels(file)), relinked: [], added: [], missing: [], cocktails: { matched: [], added: [] } };
        break;
      }
      const destination = findDestination(file.cityCode);
      const bars = destination ? barsNear(cocktailBars, cityCentre(destination), file.radiusKm) : undefined;
      const refreshed = await refreshKinds(file, PLACE_OVERRIDES[file.cityCode] ?? {}, { cocktailBars: bars });
      result = { ...refreshed, file: await addPhotosAndDescriptions(refreshed.file) };
    } catch (error) {
      log(`  ${file.cityCode} failed (${(error as Error).message.slice(0, 100)}), retrying in ${30 * (attempt + 1)}s`);
      await sleep(30_000 * (attempt + 1));
    }
  }
  if (!result) {
    failed.push(file.cityCode);
    continue;
  }
  writeFileSync(path.join(DIR, name), `${JSON.stringify(placesFileSchema.parse(result.file), null, 1)}\n`);
  const note = [
    result.relinked.length ? `relinked ${result.relinked.join(" ")}` : "",
    result.added.length ? `added ${result.added.join(" ")}` : "",
    result.missing.length ? `NOT FOUND ${result.missing.join(" ")}` : "",
    result.cocktails.matched.length ? `cocktail bars matched ${result.cocktails.matched.join(" ")}` : "",
    result.cocktails.added.length ? `cocktail bars added ${result.cocktails.added.join(" ")}` : "",
  ];
  log(`${file.cityCode} done ${note.filter(Boolean).join(", ")}`);
  await sleep(1_000);
}
log(`done: ${files.length - failed.length} files refreshed${failed.length ? `, failed: ${failed.join(" ")} (run again with their codes)` : ""}`);
