// Fails when server-only data shows up in the browser bundle (.next/static).
// Run after `npm run build`: npm run check:bundle
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const staticDir = path.join(root, ".next", "static");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const bundle = walk(staticDir)
  .filter((f) => /\.(js|css|json|html|txt)$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

// A sample of place names from the pre-fetched city files (server-only data).
const placesDir = path.join(root, "src", "data", "places");
const names = readdirSync(placesDir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => {
    const data = JSON.parse(readFileSync(path.join(placesDir, f), "utf8"));
    return Object.values(data.categories).flatMap((c) => (c.status === "ok" ? c.places.map((p) => p.name) : []));
  })
  .filter((name) => name.length >= 12)
  .filter((_, i) => i % 50 === 0);

const leaks = names.filter((name) => bundle.includes(name));
if (names.length < 50) {
  console.error(`Only ${names.length} sample names found; is src/data/places filled?`);
  process.exit(1);
}
if (leaks.length) {
  console.error(`Server-only place data found in the client bundle: ${leaks.slice(0, 5).join(", ")}`);
  process.exit(1);
}
console.log(`OK: none of ${names.length} sampled place names are in the client bundle.`);
