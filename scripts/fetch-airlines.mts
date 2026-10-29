/**
 * Writes src/data/airlines.json: airline names by IATA designator from Wikidata (P229, CC0);
 * src/lib/airlines/build.ts. Run with `npm run data:airlines`; a few seconds.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { AIRLINES_FILE_VERSION, fetchAirlines, type AirlinesFile } from "../src/lib/airlines/build";

const FILE = path.join(import.meta.dirname, "..", "src", "data", "airlines.json");
const airlines = await fetchAirlines();
const file: AirlinesFile = {
  version: AIRLINES_FILE_VERSION,
  fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  source: { name: "Wikidata: IATA airline designator (P229), Turkish and English labels", url: "https://www.wikidata.org/", terms: "CC0 1.0" },
  airlines,
};
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
console.log(`wrote ${Object.keys(airlines).length} airlines to src/data/airlines.json`);
