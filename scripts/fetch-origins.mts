/**
 * Writes src/data/origins.json: every city with a scheduled large or medium airport (OurAirports, public domain),
 * Turkish names from Wikidata (CC0), time zones from GeoNames (CC BY 4.0); src/lib/origins/build.ts. Run with
 * `npm run data:origins`; a couple of minutes. The app reads the file only on the server (src/lib/origins/data.ts).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { DESTINATIONS } from "../src/data/destinations";
import { buildOrigins } from "../src/lib/origins/build";
import { originsFileSchema } from "../src/lib/origins/file";
import { METRO_AREAS } from "../src/lib/origins/metros";
import { fetchGeoNames, fetchLabels, fetchOurAirports, fetchWikidataAirports, pickAirportItems } from "../src/lib/origins/source";

const FILE = path.join(import.meta.dirname, "..", "src", "data", "origins.json");
const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const [airports, places] = await Promise.all([fetchOurAirports(), fetchGeoNames()]);
log(`OurAirports: ${airports.length} airports with an IATA code; GeoNames: ${places.length} places`);
const codes = new Set(airports.filter((a) => a.scheduled || DESTINATIONS.some((d) => d.airports.includes(a.iata))).map((a) => a.iata));
const items = await fetchWikidataAirports(codes);
log(`Wikidata: ${items.length} airport items`);
const itemLabels = await fetchLabels(items.map((i) => i.qid));
const wdAirports = pickAirportItems(items, itemLabels);
const placeIds = [...wdAirports.flatMap((a) => a.served), ...METRO_AREAS.map((m) => m.qid), ...DESTINATIONS.map((d) => d.wikidataId)];
const wdPlaces = await fetchLabels(placeIds);
log(`Wikidata: labels for ${itemLabels.size} airports and ${wdPlaces.size} places`);

const file = originsFileSchema.parse(
  buildOrigins({
    airports,
    places,
    wdAirports,
    wdPlaces,
    destinations: DESTINATIONS,
    metros: METRO_AREAS,
    fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  }),
);
const missing = DESTINATIONS.filter((d) => !file.cities.some((c) => c.code === d.cityCode)).map((d) => d.cityCode);
if (file.cities.length < 2000 || missing.length) {
  throw new Error(`Refusing to write ${file.cities.length} cities${missing.length ? `; destinations missing: ${missing.join(" ")}` : ""}`);
}

// One city per line: the monthly refresh's diff shows which cities changed.
const { cities, ...head } = file;
const body = JSON.stringify(head, null, 1).replace(/\n}$/, "");
writeFileSync(FILE, `${body},\n "cities": [\n${cities.map((c) => `  ${JSON.stringify(c)}`).join(",\n")}\n ]\n}\n`);
log(`wrote ${cities.length} cities (${cities.reduce((n, c) => n + c.airports.length, 0)} airports) to src/data/origins.json`);
