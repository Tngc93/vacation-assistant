/**
 * Fetches each destination's big recurring events from Wikidata into src/data/events/<CODE>.json
 * (src/lib/events/wikidata.ts). Run with `npm run data:events` (optionally `-- MUC VCE`); a few minutes for all
 * cities, one city at a time. A city whose queries fail keeps its old file.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cityCentre, DESTINATIONS } from "../src/data/destinations";
import { EVENT_EXCLUSIONS } from "../src/data/event-overrides";
import { EVENTS_FILE_VERSION, eventsFileSchema, type EventsFile } from "../src/lib/events/file";
import { fetchCityEvents, fetchEventClasses, MIN_EVENT_WIKIPEDIAS } from "../src/lib/events/wikidata";

const DIR = path.join(import.meta.dirname, "..", "src", "data", "events");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

mkdirSync(DIR, { recursive: true });
const wanted = new Set(process.argv.slice(2).map((c) => c.toUpperCase()));
const cities = DESTINATIONS.filter((d) => wanted.size === 0 || wanted.has(d.cityCode));
const failed: string[] = [];
const classes = await fetchEventClasses();
for (const destination of cities) {
  const now = new Date();
  let events: EventsFile["events"] | undefined;
  for (let attempt = 0; attempt < 3 && !events; attempt++) {
    try {
      events = await fetchCityEvents(
        { wikidataId: destination.wikidataId, countryCode: destination.countryCode, ...cityCentre(destination), radiusKm: destination.radiusKm },
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
