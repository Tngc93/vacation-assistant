import { inflateRawSync } from "node:zlib";
import { externalFetch, timeoutSignal } from "@/lib/net";
import { sparql } from "@/lib/places/landmarks";
import { USER_AGENT, type Fetcher } from "@/lib/places/overpass";
import type { GeoPlace, OaAirport, WdAirport, WdPlace } from "./build";

/**
 * Network side of `npm run data:origins` (never used by the app at run time): OurAirports' airport list, GeoNames'
 * places for time zones, and Wikidata labels.
 */

export const OURAIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
export const GEONAMES_URL = "https://download.geonames.org/export/dump/cities1000.zip";
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** Labels are asked for this many items per query; one query for all of them times out. */
const LABEL_BATCH = 500;

async function download(url: string, fetcher: Fetcher): Promise<Buffer> {
  const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT }, signal: timeoutSignal(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** RFC 4180 rows: quoted fields may hold commas, line breaks and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

/** OurAirports' airports.csv (public domain), every row with an IATA code. */
export function parseOurAirports(text: string): OaAirport[] {
  const [head, ...rows] = parseCsv(text);
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`OurAirports: no "${name}" column`);
    return i;
  };
  const c = {
    iata: col("iata_code"),
    type: col("type"),
    name: col("name"),
    lat: col("latitude_deg"),
    lon: col("longitude_deg"),
    country: col("iso_country"),
    region: col("iso_region"),
    municipality: col("municipality"),
    scheduled: col("scheduled_service"),
  };
  return rows
    .filter((r) => r[c.iata])
    .map((r) => ({
      iata: r[c.iata].trim().toUpperCase(),
      type: r[c.type],
      name: r[c.name].trim(),
      lat: Number(r[c.lat]),
      lon: Number(r[c.lon]),
      country: r[c.country],
      region: r[c.region],
      municipality: r[c.municipality].trim(),
      scheduled: r[c.scheduled] === "yes",
    }));
}

export async function fetchOurAirports({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<OaAirport[]> {
  const airports = parseOurAirports((await download(OURAIRPORTS_URL, fetcher)).toString("utf8"));
  if (airports.length < 5000) throw new Error(`OurAirports: only ${airports.length} airports with an IATA code`);
  return airports;
}

/** The one file in a zip archive (GeoNames' dumps hold a single text file), without a zip library. */
export function unzipSingle(zip: Buffer, name: string): Buffer {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip file");
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extra = zip.readUInt16LE(p + 30);
    const comment = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    if (zip.toString("utf8", p + 46, p + 46 + nameLength) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`zip method ${method} not supported`);
    }
    p += 46 + nameLength + extra + comment;
  }
  throw new Error(`${name} not in the zip file`);
}

/** GeoNames' cities1000 (CC BY 4.0): every place of 1,000+ people with its IANA time zone. */
export function parseGeoNames(text: string): GeoPlace[] {
  return text.split("\n").flatMap((line) => {
    const f = line.split("\t");
    return f.length > 17 && f[17] ? [{ lat: Number(f[4]), lon: Number(f[5]), country: f[8], timeZone: f[17] }] : [];
  });
}

export async function fetchGeoNames({ fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<GeoPlace[]> {
  const places = parseGeoNames(unzipSingle(await download(GEONAMES_URL, fetcher), "cities1000.txt").toString("utf8"));
  if (places.length < 100_000) throw new Error(`GeoNames: only ${places.length} places`);
  return places;
}

type Binding = Record<string, { value: string } | undefined>;
const rows = (json: unknown): Binding[] => (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? [];
const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/** Wikidata items with an IATA airport code (P238) among `codes`, and the places each serves (P931). */
export async function fetchWikidataAirports(codes: ReadonlySet<string>, { fetcher = externalFetch }: { fetcher?: Fetcher } = {}) {
  const json = await sparql("SELECT ?iata ?airport ?served WHERE { ?airport wdt:P238 ?iata . OPTIONAL { ?airport wdt:P931 ?served } }", fetcher);
  const byItem = new Map<string, { iata: string; qid: string; served: Set<string> }>();
  for (const b of rows(json)) {
    if (!b.iata || !b.airport) continue;
    const iata = b.iata.value.toUpperCase();
    if (!codes.has(iata)) continue;
    const qid = qidOf(b.airport.value);
    const entry = byItem.get(qid) ?? { iata, qid, served: new Set<string>() };
    if (b.served) entry.served.add(qidOf(b.served.value));
    byItem.set(qid, entry);
  }
  return [...byItem.values()];
}

export function labelsQuery(qids: readonly string[]): string {
  return `SELECT ?item ?tr ?en ?native ?links ?coord WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} }
  ?item wikibase:sitelinks ?links .
  OPTIONAL { ?item rdfs:label ?tr FILTER(LANG(?tr) = "tr") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item wdt:P1705 ?native }
  OPTIONAL { ?item wdt:P625 ?coord }
}`;
}

const POINT = /^Point\(([-\d.e]+) ([-\d.e]+)\)$/i;

export function parseLabels(json: unknown, into = new Map<string, WdPlace>()): Map<string, WdPlace> {
  for (const b of rows(json)) {
    if (!b.item) continue;
    const qid = qidOf(b.item.value);
    const entry = into.get(qid) ?? { qid, native: [], sitelinks: Number(b.links?.value ?? 0) || 0 };
    if (b.tr) entry.tr = b.tr.value;
    if (b.en) entry.en = b.en.value;
    if (b.native && !entry.native.includes(b.native.value)) entry.native.push(b.native.value);
    const point = b.coord?.value.match(POINT);
    if (point && entry.lat === undefined) {
      entry.lon = Number(point[1]);
      entry.lat = Number(point[2]);
    }
    into.set(qid, entry);
  }
  return into;
}

/** Turkish, English and native labels, coordinates and the Wikipedia count of each item. */
export async function fetchLabels(qids: Iterable<string>, { fetcher = externalFetch }: { fetcher?: Fetcher } = {}) {
  const labels = new Map<string, WdPlace>();
  const unique = [...new Set(qids)].sort();
  for (let i = 0; i < unique.length; i += LABEL_BATCH) {
    parseLabels(await sparql(labelsQuery(unique.slice(i, i + LABEL_BATCH)), fetcher), labels);
  }
  return labels;
}

/** One airport per IATA code: the Wikidata item with the most Wikipedia languages (closed namesakes lose). */
export function pickAirportItems(items: Array<{ iata: string; qid: string; served: Set<string> }>, labels: Map<string, WdPlace>): WdAirport[] {
  const best = new Map<string, WdAirport>();
  for (const item of items) {
    const l = labels.get(item.qid);
    const candidate: WdAirport = { iata: item.iata, qid: item.qid, tr: l?.tr, en: l?.en, sitelinks: l?.sitelinks ?? 0, served: [...item.served].sort() };
    const current = best.get(item.iata);
    if (!current || candidate.sitelinks > current.sitelinks) best.set(item.iata, candidate);
  }
  return [...best.values()];
}
