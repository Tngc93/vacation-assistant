/**
 * Audits the Wikidata links of the sights the guide and the plan show
 * (src/data/places/, rules applied), against Wikidata itself:
 *
 * 1. An OSM object whose wikidata tag points at an item with no coordinate,
 *    or one more than 1 km away, is probably linked to the wrong item (a
 *    concept, an institution), and its Wikipedia count inflates its rank.
 * 2. Items that are official residences, legislatures, government buildings,
 *    embassies or military sites may not be open to visitors. Wikidata says
 *    what they are, not whether they can be visited, so these are listed for
 *    a person to decide (Palace of Westminster has tours, the Élysée does not).
 *
 * Fixes go to src/data/place-overrides.ts. Read-only, needs the network,
 * not run in CI: `npm run verify:place-links` (optionally `-- PAR ROM`).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { distanceKm } from "../src/lib/geo";
import { placesFileSchema } from "../src/lib/places/file";
import { USER_AGENT } from "../src/lib/places/overpass";
import { applyPlaceRules } from "../src/lib/places/rules";

const DIR = path.join(import.meta.dirname, "..", "src", "data", "places");
const WDQS = "https://query.wikidata.org/sparql";
const BATCH = 150;
/** An OSM point this far from every coordinate of its Wikidata item is linked to something else (1 km flags
 * long features like Cheonggyecheon and museum branches near their institution's address). */
const FAR_KM = 2;

/** Not places: a link to one of these (and to none of our sight kinds) is a wrong link. */
const NOT_PLACES = {
  Q43229: "organization",
  Q5: "human",
  Q1190554: "occurrence",
  Q483247: "phenomenon",
  Q151885: "concept",
  Q7184903: "abstract entity",
} as const;
/** Residences and seats of government: usually closed to visitors (the Élysée, 10 Downing Street). The rule. */
const RESIDENCES = { Q481289: "official residence", Q1901835: "seat of government" } as const;
/** Often visitable (parliament tours, city halls), so listed for a person to decide, not ruled. */
const MAYBE_CLOSED = {
  ...RESIDENCES,
  Q16831714: "government building",
  Q30124446: "legislative building",
  Q11204: "legislature",
  Q3917681: "embassy",
} as const;
/** Higher education institutions: a link to one from a sight is the school, not the building's sight. */
const UNIVERSITY = "Q38723";
/** Stored kinds that make an item a place we show, whatever else it is (the Louvre is also an organization). */
const SIGHT_KINDS = ["museum", "ruins", "attraction", "palace", "castle", "religious", "tower", "street", "square", "bridge", "promenade", "opera", "concertHall", "musicVenue", "theatre", "performingArts"];

type Row = Record<string, { value: string } | undefined>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const qid = (uri = "") => /Q[1-9]\d*$/.exec(uri)?.[0] ?? "";

async function sparql(query: string): Promise<Row[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(WDQS, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(65_000),
    }).catch((error: Error) => error);
    if (res instanceof Response && res.ok) return ((await res.json()) as { results: { bindings: Row[] } }).results.bindings;
    if (attempt >= 2) throw new Error(`WDQS ${res instanceof Response ? res.status : res.message}`);
    await sleep(30_000 * (attempt + 1));
  }
}

type Shown = { code: string; category: string; id: string; name: string; qid: string; lat: number; lon: number; wikipediaCount?: number; kinds: string[] };

const wanted = new Set(process.argv.slice(2).map((c) => c.toUpperCase()));
const places: Shown[] = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const raw = placesFileSchema.parse(JSON.parse(readFileSync(path.join(DIR, file), "utf8")));
  const data = applyPlaceRules(raw);
  const kindsOf = new Map(
    (["see", "museum", "viewpoint"] as const).flatMap((c) => {
      const e = raw.categories[c];
      return e.status === "ok" ? e.places.map((p) => [p.id, p.kinds ?? []] as const) : [];
    }),
  );
  if (wanted.size && !wanted.has(data.cityCode)) continue;
  for (const category of ["see", "museum", "viewpoint"] as const) {
    const entry = data.categories[category];
    if (entry.status !== "ok") continue;
    for (const p of entry.places) {
      if (p.wikidataId) {
        const base = { code: data.cityCode, category, id: p.id, name: p.name, qid: p.wikidataId, lat: p.lat, lon: p.lon };
        places.push({ ...base, wikipediaCount: p.wikipediaCount, kinds: [...(kindsOf.get(p.id) ?? [])] });
      }
    }
  }
}

const ids = [...new Set(places.map((p) => p.qid))].sort();
const coords = new Map<string, Array<{ lat: number; lon: number }>>();
const labels = new Map<string, string>();
const closed = new Map<string, Set<string>>();
const notPlace = new Map<string, Set<string>>();
const universities = new Set<string>();
for (let i = 0; i < ids.length; i += BATCH) {
  const values = ids.slice(i, i + BATCH).map((q) => `wd:${q}`).join(" ");
  for (const b of await sparql(`SELECT ?item ?coord ?label WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
}`)) {
    const item = qid(b.item?.value);
    if (!coords.has(item)) coords.set(item, []);
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? "");
    if (m) coords.get(item)!.push({ lon: Number(m[1]), lat: Number(m[2]) });
    if (b.label?.value) labels.set(item, b.label.value);
  }
  await sleep(1_000);
  const classes = { ...NOT_PLACES, ...MAYBE_CLOSED, [UNIVERSITY]: "university" };
  for (const b of await sparql(`SELECT DISTINCT ?item ?class WHERE {
  hint:Query hint:optimizer "None" .
  VALUES ?item { ${values} }
  ?item wdt:P31 ?type . ?type wdt:P279* ?class .
  FILTER(?class IN (${Object.keys(classes).map((c) => `wd:${c}`).join(", ")}))
}`)) {
    const item = qid(b.item?.value);
    const cls = qid(b.class?.value);
    if (cls === UNIVERSITY) {
      universities.add(item);
      continue;
    }
    const into = cls in NOT_PLACES ? notPlace : closed;
    if (!into.has(item)) into.set(item, new Set());
    into.get(item)!.add(classes[cls as keyof typeof classes]);
  }
  await sleep(1_000);
}

const line = (p: Shown, why: string) =>
  `| ${p.code} | ${p.category} | ${p.name} | ${p.qid} (${labels.get(p.qid) ?? "?"}) | ${p.wikipediaCount ?? "–"} | ${why} |`;
const header = "| City | Category | Name | Wikidata item | Languages | Why |\n|---|---|---|---|---|---|";

const isSightKind = (p: Shown) => p.kinds.some((k) => SIGHT_KINDS.includes(k));
const kmToItem = (p: Shown) => {
  const points = coords.get(p.qid) ?? [];
  return points.length ? Math.min(...points.map((c) => distanceKm(p.lat, p.lon, c.lat, c.lon))) : null;
};
const osm = places.filter((p) => !p.id.startsWith("wikidata/"));
/** The proposed rule for wrong links, and why it fires. */
const wrongWhy = (p: Shown): string | null => {
  const km = kmToItem(p);
  if (km !== null && km > FAR_KM) return `item ${km.toFixed(1)} km away`;
  // Without a coordinate an event, person or idea is never the place; an organization is not one when OSM calls the
  // object a sight (a bank, a city council), but a museum's own organization item often lacks a coordinate (Tallinn).
  const types = [...(notPlace.get(p.qid) ?? [])];
  if (km === null && types.some((t) => t !== "organization")) return `${types.sort().join(", ")}, no coordinate`;
  if (km === null && types.includes("organization") && p.category !== "museum") return "organization, no coordinate";
  if (universities.has(p.qid) && !isSightKind(p)) return "a university";
  return null;
};
const wrong = osm.filter((p) => wrongWhy(p));
const residence = (p: Shown) => [...(closed.get(p.qid) ?? [])].filter((k) => Object.values(RESIDENCES).includes(k as never));
const exempt = (p: Shown) => p.kinds.some((k) => ["museum", "ruins"].includes(k));
const ruledClosed = places.filter((p) => residence(p).length > 0 && !exempt(p));
const listed = places.filter((p) => closed.has(p.qid) && !ruledClosed.includes(p) && (p.wikipediaCount ?? 0) >= 20);

const section = (title: string, list: Shown[], why: (p: Shown) => string) =>
  console.log(`## ${title} (${list.length})\n\n${header}\n${[...list].sort((a, b) => (b.wikipediaCount ?? 0) - (a.wikipediaCount ?? 0)).map((p) => line(p, why(p))).join("\n")}\n`);
console.log(`# Place link audit\n\n${places.length} shown sights with a Wikidata item in ${new Set(places.map((p) => p.code)).size} cities.\n`);
section("Rule 1 — wrong link, its Wikipedia count no longer counts", wrong, (p) => wrongWhy(p)!);
section("Rule 2 — residence or seat of government, not a plan stop", ruledClosed, (p) => [...residence(p), ...p.kinds].join(", "));
section("Not ruled (often visitable): government, legislative and embassy buildings, 20+ languages", listed, (p) =>
  [...closed.get(p.qid)!, ...p.kinds].join(", "),
);
