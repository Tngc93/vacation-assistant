/**
 * Writes src/data/world-dots.json: the home page's dot map, a half-degree land grid built from Natural Earth's 1:110m land
 * polygons (public domain); src/lib/home/worldDots.ts. Run with `npm run data:world-dots`; a few seconds.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  WORLD_DOTS_FILE_VERSION,
  WORLD_GRID,
  buildLandGrid,
  encodeBits,
  polygonsFromGeoJson,
  type WorldDotsFile,
} from "../src/lib/home/worldDots";

const URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson";
const FILE = path.join(import.meta.dirname, "..", "src", "data", "world-dots.json");

const response = await fetch(URL, { headers: { "User-Agent": "VacationAssistant/0.1 (https://github.com/Tngc93/vacation-assistant)" } });
if (!response.ok) throw new Error(`Natural Earth: HTTP ${response.status}`);
const polygons = polygonsFromGeoJson(await response.json());
const land = buildLandGrid(polygons);

const file: WorldDotsFile = {
  version: WORLD_DOTS_FILE_VERSION,
  fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  source: { name: "Natural Earth: 1:110m land polygons (v5.1.2)", url: "https://www.naturalearthdata.com/", terms: "Public domain" },
  ...WORLD_GRID,
  bits: encodeBits(land),
};
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
console.log(`wrote ${land.filter(Boolean).length} land cells of ${land.length} from ${polygons.length} polygons to src/data/world-dots.json`);
