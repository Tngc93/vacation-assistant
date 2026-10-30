/**
 * Fetches each destination's big recurring events from Wikidata into src/data/events/<CODE>.json
 * (src/lib/events/wikidata.ts). Run with `npm run data:events` (optionally `-- MUC VCE`); a few minutes for all
 * cities, one city at a time. A city whose queries fail keeps its old file. `-- --labels` adds only the English
 * names to the stored files (addEnglishEventNames) and changes nothing else.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cityCentre, DESTINATIONS, englishPlaceWords } from "../src/data/destinations";
import { EVENT_EXCLUSIONS } from "../src/data/event-overrides";
import { EVENTS_FILE_VERSION, eventsFileSchema, type EventsFile } from "../src/lib/events/file";
import { addEnglishEventNames, fetchCityEvents, fetchEventClasses, MIN_EVENT_WIKIPEDIAS } from "../src/lib/events/wikidata";

const DIR = path.join(import.meta.dirname, "..", "src", "data", "events");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

mkdirSync(DIR, { recursive: true });
const args = process.argv.slice(2);
const wanted = new Set(args.filter((a) => !a.startsWith("--")).map((c) => c.toUpperCase()));
const cities = DESTINATIONS.filter((d) => wanted.size === 0 || wanted.has(d.cityCode));
const failed: string[] = [];
if (args.includes("--labels")) {
  for (const destination of cities) {
    const at = path.join(DIR, `${destination.cityCode}.json`);
    if (!existsSync(at)) continue;
    const raw = JSON.parse(readFileSync(at, "utf8")) as Record<string, unknown>;
    const file = eventsFileSchema.parse({ ...raw, version: EVENTS_FILE_VERSION });
    try {
      writeFileSync(at, `${JSON.stringify(eventsFileSchema.parse(await addEnglishEventNames(file, { placeWords: englishPlaceWords(destination) })), null, 1)}\n`);
      log(`${destination.cityCode} English names`);
    } catch (error) {
      failed.push(destination.cityCode);
      log(`  ${destination.cityCode} failed (${(error as Error).message.slice(0, 100)})`);
    }
    await sleep(500);
  }
  log(`done${failed.length ? `, failed: ${failed.join(" ")}` : ""}`);
  process.exit(failed.length ? 1 : 0);
}
const classes = await fetchEventClasses();
for (const destination of cities) {
  const now = new Date();
  let events: EventsFile["events"] | undefined;
  for (let attempt = 0; attempt < 3 && !events; attempt++) {
    try {
      events = await fetchCityEvents(
        { wikidataId: destination.wikidataId, countryCode: destination.countryCode, ...cityCentre(destination), radiusKm: destination.radiusKm, placeWords: englishPlaceWords(destination) },
        { now, classes, exclude: (EVENT_EXCLUSIONS[destination.cityCode] ?? []).map((e) => e.qid) },
      );
    } catch (error) {
      log(`  ${destination.cityCode} failed (${(error as Error).message.slice(0, 100)}), retrying in ${30 * (attempt + 1)}s`);
      await sleep(30_000 * (attempt + 1));
    }
  }
  if (!events) {
    failed.push(destination.cityCode);
    continue;
  }
  const file = eventsFileSchema.parse({
    version: EVENTS_FILE_VERSION,
    cityCode: destination.cityCode,
    fetchedAt: now.toISOString().replace(/\.\d+Z$/, "Z"),
    minWikipedias: MIN_EVENT_WIKIPEDIAS,
    license: { name: "CC0-1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
    events,
  } satisfies EventsFile);
  writeFileSync(path.join(DIR, `${destination.cityCode}.json`), `${JSON.stringify(file, null, 1)}\n`);
  const exact = events.filter((e) => e.editions).length;
  log(`${destination.cityCode} ${events.length} events (${exact} exact, ${events.length - exact} approximate)`);
  await sleep(1_000);
}
log(`done: ${cities.length - failed.length} cities${failed.length ? `, failed: ${failed.join(" ")} (run again with their codes)` : ""}`);
