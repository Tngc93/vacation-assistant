// Re-checks src/data/destinations.ts against Wikidata (network required, not run in CI).
// Usage: npm run verify:destinations
import { DESTINATIONS } from "../src/data/destinations.ts";

const ENDPOINT = "https://query.wikidata.org/sparql";
const HEADERS = {
  Accept: "application/sparql-results+json",
  "User-Agent": "vacation-assistant-data-check/0.1 (https://github.com/Tngc93/vacation-assistant)",
};
// Roughly 110 m; Wikidata coordinates are rounded to 4 decimals in the data file.
const TOLERANCE = 0.001;

async function sparql(query) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
  return (await res.json()).results.bindings;
}

const problems = [];

const cities = await sparql(`SELECT ?item ?coord WHERE {
  VALUES ?item { ${DESTINATIONS.map((d) => `wd:${d.wikidataId}`).join(" ")} }
  ?item wdt:P625 ?coord.
}`);
const coordsById = new Map();
for (const row of cities) {
  const id = row.item.value.split("/").pop();
  const [lon, lat] = row.coord.value.match(/-?[\d.]+/g).map(Number);
  coordsById.set(id, [...(coordsById.get(id) ?? []), { lat, lon }]);
}
for (const d of DESTINATIONS) {
  const coords = coordsById.get(d.wikidataId);
  if (!coords) {
    problems.push(`${d.cityCode} ${d.wikidataId}: no coordinates on Wikidata`);
  } else if (!coords.some((c) => Math.abs(c.lat - d.lat) < TOLERANCE && Math.abs(c.lon - d.lon) < TOLERANCE)) {
    problems.push(`${d.cityCode} ${d.wikidataId}: ${d.lat},${d.lon} does not match ${JSON.stringify(coords)}`);
  }
}

const codes = [...new Set(DESTINATIONS.flatMap((d) => d.airports))];
const airports = await sparql(`SELECT ?code WHERE {
  VALUES ?code { ${codes.map((c) => JSON.stringify(c)).join(" ")} }
  ?airport wdt:P238 ?code.
}`);
const known = new Set(airports.map((row) => row.code.value));
for (const code of codes) {
  if (!known.has(code)) problems.push(`airport ${code}: no Wikidata item with this IATA code (P238)`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`OK: ${DESTINATIONS.length} destinations and ${codes.length} airport codes match Wikidata.`);
