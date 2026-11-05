/**
 * The home page's dot map (DESIGN.md "Home background"): a grid of land cells on an equirectangular world, built
 * from Natural Earth's land polygons (public domain) by `npm run data:world-dots` and stored as a bitmask in
 * src/data/world-dots.json (a few kilobytes). Pure functions: the script builds the grid, the browser reads it.
 */

/** [lon, lat] */
export type Position = readonly [number, number];
/** An outer ring followed by its holes. */
export type Polygon = readonly (readonly Position[])[];

export const WORLD_DOTS_FILE_VERSION = 1;

/** The grid: one cell per `step` degrees, rows from `latMax` southwards, columns from `lonMin` eastwards. */
export type GridSpec = { lonMin: number; latMax: number; step: number; cols: number; rows: number };

export type WorldDotsFile = GridSpec & {
  version: typeof WORLD_DOTS_FILE_VERSION;
  fetchedAt: string;
  source: { name: string; url: string; terms: string };
  /** Base64 of the land bitmask, row by row, most significant bit first. */
  bits: string;
};

/**
 * 1° cells from 80°N to 56°S: Antarctica and the high Arctic carry no destination and would only stretch the
 * equirectangular map.
 */
export const WORLD_GRID: GridSpec = { lonMin: -180, latMax: 80, step: 1, cols: 360, rows: 136 };

/** Ray casting; points exactly on an edge may fall either way, which a dot grid never notices. */
export function pointInRing(lon: number, lat: number, ring: readonly Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(lon: number, lat: number, polygon: Polygon): boolean {
  if (!polygon.length || !pointInRing(lon, lat, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) if (pointInRing(lon, lat, polygon[h])) return false;
  return true;
}

type Geometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };

/** The polygons of a GeoJSON FeatureCollection (Polygon and MultiPolygon features; anything else is skipped). */
export function polygonsFromGeoJson(collection: { features: { geometry: Geometry | null }[] }): Polygon[] {
  return collection.features.flatMap(({ geometry }) => {
    if (geometry?.type === "Polygon") return [geometry.coordinates];
    if (geometry?.type === "MultiPolygon") return geometry.coordinates;
    return [];
  });
}

type Box = { minLon: number; maxLon: number; minLat: number; maxLat: number };

function bbox(polygon: Polygon): Box {
  const box = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const [lon, lat] of polygon[0]) {
    box.minLon = Math.min(box.minLon, lon);
    box.maxLon = Math.max(box.maxLon, lon);
    box.minLat = Math.min(box.minLat, lat);
    box.maxLat = Math.max(box.maxLat, lat);
  }
  return box;
}

/**
 * A cell is land when at least `minLand` of its `samples × samples` sample points are on land: a third of the cell
 * keeps islands such as Malta or Mallorca's neighbours from vanishing without fattening the coasts much.
 */
export function buildLandGrid(polygons: readonly Polygon[], grid: GridSpec = WORLD_GRID, samples = 3, minLand = 3): boolean[] {
  const indexed = polygons.map((p) => ({ p, box: bbox(p) }));
  const land: boolean[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      let hits = 0;
      for (let sy = 0; sy < samples && hits < minLand; sy++) {
        for (let sx = 0; sx < samples && hits < minLand; sx++) {
          const lat = grid.latMax - (r + (sy + 0.5) / samples) * grid.step;
          const lon = grid.lonMin + (c + (sx + 0.5) / samples) * grid.step;
          if (indexed.some(({ p, box }) => lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat && pointInPolygon(lon, lat, p)))
            hits++;
        }
      }
      land.push(hits >= minLand);
    }
  }
  return land;
}

export function encodeBits(bits: readonly boolean[]): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((on, i) => {
    if (on) bytes[i >> 3] |= 0x80 >> (i & 7);
  });
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBits(base64: string, count: number): Uint8Array {
  const binary = atob(base64);
  const bits = new Uint8Array(count);
  for (let i = 0; i < count; i++) bits[i] = (binary.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return bits;
}

/** A land dot: the centre of a grid cell, in degrees. */
export type Dot = { lon: number; lat: number; row: number; col: number };

/**
 * The dots of every `every`-th row and column (2 on desktop, 3 on phones: a sparser grid), so the same file serves
 * both densities.
 */
export function landDots(file: Pick<WorldDotsFile, keyof GridSpec | "bits">, every = 1): Dot[] {
  const bits = decodeBits(file.bits, file.rows * file.cols);
  const dots: Dot[] = [];
  for (let r = 0; r < file.rows; r += every) {
    for (let c = 0; c < file.cols; c += every) {
      if (bits[r * file.cols + c])
        dots.push({ row: r, col: c, lat: file.latMax - (r + 0.5) * file.step, lon: file.lonMin + (c + 0.5) * file.step });
    }
  }
  return dots;
}
