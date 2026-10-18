/**
 * Refreshes the Wikidata facts of the stored place files without Overpass: applies the relink overrides
 * (src/data/place-overrides.ts) and stores every sight's kinds and link tags (src/lib/places/refresh.ts).
 * Run with `npm run data:kinds` (optionally `-- NYC DUB`); a few minutes for all cities, one city at a time.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PLACE_OVERRIDES } from "../src/data/place-overrides";
import { placesFileSchema } from "../src/lib/places/file";
import { refreshKinds } from "../src/lib/places/refresh";

const DIR = path.join(import.meta.dirname, "..", "src", "data", "places");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const wanted = new Set(process.argv.slice(2).map((c) => c.toUpperCase()));
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (wanted.size === 0 || wanted.has(f.slice(0, 3)))).sort();
const failed: string[] = [];
for (const name of files) {
  const file = placesFileSchema.parse(JSON.parse(readFileSync(path.join(DIR, name), "utf8")));
  let result: Awaited<ReturnType<typeof refreshKinds>> | undefined;
  for (let attempt = 0; attempt < 3 && !result; attempt++) {
    try {
      result = await refreshKinds(file, PLACE_OVERRIDES[file.cityCode] ?? {});
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
  ];
  log(`${file.cityCode} done ${note.filter(Boolean).join(", ")}`);
  await sleep(1_000);
}
log(`done: ${files.length - failed.length} files refreshed${failed.length ? `, failed: ${failed.join(" ")} (run again with their codes)` : ""}`);
