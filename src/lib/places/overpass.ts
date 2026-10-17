import { externalFetch, timeoutSignal } from "@/lib/net";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "./categories";

/** Public Overpass instances, tried in order. */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

/** Server-side timeout inside the query; the HTTP timeout allows for queueing on a busy instance. */
export const OVERPASS_QUERY_TIMEOUT_S = 25;
export const OVERPASS_HTTP_TIMEOUT_MS = 45_000;
/** Upper bound on elements per category; ranking then keeps the best 30. */
export const OVERPASS_MAX_ELEMENTS = 400;

export const USER_AGENT = "VacationAssistant/0.1 (https://github.com/Tngc93/vacation-assistant)";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Bounding box around a point: [south, west, north, east], rounded so the query text is stable. */
export function boundingBox(rawLat: number, rawLon: number, radiusKm: number): [number, number, number, number] {
  // Round the centre first so tiny coordinate noise never changes the query (or its cache entry).
  const lat = Number(rawLat.toFixed(4));
  const lon = Number(rawLon.toFixed(4));
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (n: number) => Number(n.toFixed(4));
  return [r(lat - dLat), r(lon - dLon), r(lat + dLat), r(lon + dLon)];
}

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

/**
 * One deterministic query per city and category (same input, same text, same
 * cache entry). A global bounding box is far cheaper for Overpass than
 * `around`; results are then cut to the real radius in code.
 */
export function buildOverpassQuery(category: CategoryId, lat: number, lon: number, radiusKm: number): string {
  const bbox = boundingBox(lat, lon, radiusKm).join(",");
  const statements = CATEGORIES[category].filters.map((f) => `  nwr${f}["name"];`).join("\n");
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}][bbox:${bbox}];\n(\n${statements}\n);\nout tags center ${OVERPASS_MAX_ELEMENTS};`;
}

/**
 * One query per city covering every category, each with its own output
 * limit. Used by the offline data script so a city costs Overpass one
 * request instead of eight.
 */
export function buildCityQuery(lat: number, lon: number, radiusKm: number, timeoutS = 120): string {
  const bbox = boundingBox(lat, lon, radiusKm).join(",");
  const blocks = CATEGORY_IDS.map((category) => {
    const statements = CATEGORIES[category].filters.map((f) => `  nwr${f}["name"];`).join("\n");
    return `(\n${statements}\n);\nout tags center ${OVERPASS_MAX_ELEMENTS};`;
  });
  return `[out:json][timeout:${timeoutS}][bbox:${bbox}];\n${blocks.join("\n")}`;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Runs a query against each endpoint in turn. Overpass sometimes answers 200
 * with a "remark" describing a timeout or error; that counts as a failure so
 * a partial result is never cached as if it were complete.
 */
export async function runOverpass(
  query: string,
  { fetcher = externalFetch, timeoutMs = OVERPASS_HTTP_TIMEOUT_MS }: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<OverpassElement[]> {
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: new URLSearchParams({ data: query }).toString(),
        signal: timeoutSignal(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: unknown; remark?: string };
      if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(`remark: ${json.remark}`);
      if (!Array.isArray(json.elements)) throw new Error("no elements");
      return json.elements as OverpassElement[];
    } catch (error) {
      const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
      failures.push(`${new URL(endpoint).host}: ${name === "TimeoutError" ? "timeout" : (error as Error).message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed (${failures.join("; ")})`);
}
