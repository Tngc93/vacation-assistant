/** Geometry of the home page's route map: an equirectangular view, great-circle routes and easing. Pure. */

export type LatLon = { lat: number; lon: number };
export type Point = { x: number; y: number };

/** The top latitude of the dot grid (src/lib/home/worldDots.ts `WORLD_GRID`). */
const LAT_TOP = 80;

/** Wraps a longitude difference into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export type View = {
  width: number;
  height: number;
  /** CSS pixels per degree. */
  scale: number;
  /** The anchor longitude, drawn at `anchorX`; longitudes wrap around it. */
  centerLon: number;
  anchorX: number;
  /** y of latitude `LAT_TOP`. */
  top: number;
};

/** Where the map is anchored: latitude `lat`, longitude `lon` drawn at `x`, `y` (CSS px), `scale` px per degree. */
export type Anchor = { lat: number; lon: number; x: number; y: number; scale: number };

/**
 * An equirectangular view of the box anchored at one point. The home map anchors Europe right of the hero text on
 * desktop and in the band under the search on a phone (src/lib/home/config.ts `frame`); what falls outside the box
 * is simply not drawn.
 */
export function makeView(width: number, height: number, { lat, lon, x, y, scale }: Anchor): View {
  return { width, height, scale, centerLon: lon, anchorX: x, top: y - (LAT_TOP - lat) * scale };
}

export function project(view: View, { lat, lon }: LatLon): Point {
  return { x: view.anchorX + wrapLon(lon - view.centerLon) * view.scale, y: view.top + (LAT_TOP - lat) * view.scale };
}

/** The point is inside the box, `margin` pixels in from every edge. */
export function isVisible(view: View, p: Point, margin = 0): boolean {
  return p.x >= margin && p.x <= view.width - margin && p.y >= margin && p.y <= view.height - margin;
}

const RAD = Math.PI / 180;

function toVector({ lat, lon }: LatLon): [number, number, number] {
  return [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

/** Central angle between two points, in radians. */
export function angularDistance(a: LatLon, b: LatLon): number {
  const [ax, ay, az] = toVector(a);
  const [bx, by, bz] = toVector(b);
  return Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz)));
}

/** `segments + 1` points along the great circle from `a` to `b` (spherical interpolation). */
export function greatCircle(a: LatLon, b: LatLon, segments = 48): LatLon[] {
  const d = angularDistance(a, b);
  if (d < 1e-9) return [a, b];
  const va = toVector(a);
  const vb = toVector(b);
  const points: LatLon[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ka = Math.sin((1 - t) * d) / Math.sin(d);
    const kb = Math.sin(t * d) / Math.sin(d);
    const x = ka * va[0] + kb * vb[0];
    const y = ka * va[1] + kb * vb[1];
    const z = ka * va[2] + kb * vb[2];
    points.push({ lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD });
  }
  return points;
}

/**
 * The route on screen. Successive points are unwrapped against each other, so a route across the edge of the view
 * leaves it instead of jumping to the other side.
 */
export function projectPath(view: View, path: readonly LatLon[]): Point[] {
  const out: Point[] = [];
  let prevLon = 0;
  path.forEach((p, i) => {
    let lon = wrapLon(p.lon - view.centerLon);
    if (i > 0) lon = prevLon + wrapLon(lon - prevLon);
    prevLon = lon;
    out.push({ x: view.anchorX + lon * view.scale, y: view.top + (LAT_TOP - p.lat) * view.scale });
  });
  return out;
}

export function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}

/** The part of the polyline up to `t` (0–1) of its length, ending exactly at the head. */
export function partialPath(points: readonly Point[], t: number): Point[] {
  if (t >= 1) return [...points];
  const target = pathLength(points) * Math.max(0, t);
  const out: Point[] = [points[0]];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + step >= target) {
      const k = step ? (target - walked) / step : 0;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      return out;
    }
    walked += step;
    out.push(b);
  }
  return out;
}

export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
