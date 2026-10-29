/**
 * Writes src/data/origins.json: every city with an airport open to flights (Travelpayouts' static data), with
 * Turkish names from Wikidata (src/lib/origins/build.ts). Run with `npm run data:origins`; about a minute.
 * The app reads the file only on the server (src/lib/origins/data.ts).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS } from "../src/data/destinations";
import { buildOrigins } from "../src/lib/origins/build";
import { originsFileSchema } from "../src/lib/origins/file";
import { fetchLabels, fetchServed, fetchTravelpayouts } from "../src/lib/origins/source";

const FILE = path.join(import.meta.dirname, "..", "src", "data", "origins.json");
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const tp = await fetchTravelpayouts();
log(`Travelpayouts: ${tp.cities.length} cities, ${tp.airports.length} airports`);
const served = await fetchServed();
log(`Wikidata: ${served.length} airport → place links`);
const labels = await fetchLabels(served.map((s) => s.qid));
log(`Wikidata: labels for ${labels.size} places`);

const file = originsFileSchema.parse(
  buildOrigins({ ...tp, served, labels, destinations: DESTINATIONS, fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z") }),
);
const missing = DESTINATIONS.filter((d) => !file.cities.some((c) => c.code === d.cityCode)).map((d) => d.cityCode);
if (file.cities.length < 2000 || missing.length) {
  throw new Error(`Refusing to write ${file.cities.length} cities${missing.length ? `; destinations missing: ${missing.join(" ")}` : ""}`);
}

// One city per line: the monthly refresh's diff shows which cities changed.
const { cities, ...head } = file;
const body = JSON.stringify(head, null, 1).replace(/\n}$/, "");
writeFileSync(FILE, `${body},\n "cities": [\n${cities.map((c) => `  ${JSON.stringify(c)}`).join(",\n")}\n ]\n}\n`);
log(`wrote ${cities.length} cities to src/data/origins.json`);
