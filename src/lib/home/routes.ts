/**
 * The routes of the home page's map (DESIGN.md "Home background"), as data: which routes are on screen and how far
 * each one has come at a given moment. Pure and deterministic (a seeded sequence picks the ambient cities), so the
 * timing is tested with plain numbers instead of animation frames; the canvas only draws what this says.
 */
import { HOME_MAP } from "./config";
import { angularDistance, clamp01, easeInOut, greatCircle, type LatLon } from "./geo";

export type Place = LatLon & { code: string };

/**
 * `ambient`: drawn, held a moment, faded. `selected`: the city chosen in "Nereye"; stays, labelled, while it is
 * chosen. `preview`: a "Keşfet" chip under the pointer or the focus; fades when it leaves.
 */
export type RouteKind = "ambient" | "selected" | "preview";

export type Route = {
  id: number;
  code: string;
  kind: RouteKind;
  path: LatLon[];
  start: number;
  drawMs: number;
  /** When it began to fade (set when a chosen or previewed city is let go). */
  leaving?: number;
};

/** Timing of the routes: src/lib/home/config.ts `timing`. */
export const TIMING = HOME_MAP.timing;

export type Scene = {
  origin: Place;
  routes: Route[];
  /** At most this many routes at once (config `routes.max`), chosen and previewed ones included. */
  maxRoutes: number;
  nextSpawnAt: number;
  /** State of the seeded sequence. */
  seed: number;
  /** The last ambient cities, not picked again soon. */
  recent: string[];
  nextId: number;
};

/** mulberry32: a small seeded sequence in [0, 1). */
function random(scene: Scene): number {
  scene.seed = (scene.seed + 0x6d2b79f5) | 0;
  let t = scene.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createScene(origin: Place, { maxRoutes, now, seed = 20261105 }: { maxRoutes: number; now: number; seed?: number }): Scene {
  // The first ambient route starts soon after the map appears.
  return { origin, routes: [], maxRoutes, nextSpawnAt: now + TIMING.firstMs, seed, recent: [], nextId: 1 };
}

function drawMsFor(from: LatLon, to: LatLon): number {
  // Longer routes take longer; anything past ~60° (İstanbul–Tokyo) takes the longest.
  const k = clamp01(angularDistance(from, to) / (Math.PI / 3));
  return Math.round(TIMING.minDrawMs + (TIMING.maxDrawMs - TIMING.minDrawMs) * k);
}

function makeRoute(scene: Scene, to: Place, kind: RouteKind, now: number): Route {
  return { id: scene.nextId++, code: to.code, kind, path: greatCircle(scene.origin, to), start: now, drawMs: drawMsFor(scene.origin, to) };
}

/** When a route starts to fade: a chosen or previewed one only when let go. */
export function fadeStart(route: Route): number {
  if (route.leaving !== undefined) return route.leaving;
  return route.kind === "ambient" ? route.start + route.drawMs + TIMING.holdMs : Infinity;
}

export function isGone(route: Route, now: number): boolean {
  return now >= fadeStart(route) + TIMING.fadeMs;
}

export type RouteLook = {
  /** Share of the route drawn, eased (0–1). */
  progress: number;
  /** Opacity of the line and of the head dot (0–1), before the kind's own opacity. */
  line: number;
  tip: number;
  /** 0 while drawing, rising to 1 as the head goes out after arrival. */
  settled: number;
  /** The ring opening from the city on arrival: 0–1 through it, null outside it. */
  pulse: number | null;
  /**
   * Opacity of the city's code beside it (0–1): an ambient route shows it for a moment on arrival; a chosen or
   * previewed one keeps it (with the origin's) while it stays.
   */
  label: number;
};

export function routeLook(route: Route, now: number): RouteLook {
  const t = (now - route.start) / route.drawMs;
  const fade = 1 - clamp01((now - fadeStart(route)) / TIMING.fadeMs);
  const arrivedFor = now - (route.start + route.drawMs);
  return {
    progress: easeInOut(t),
    line: fade,
    tip: (arrivedFor <= 0 ? 1 : 1 - clamp01(arrivedFor / TIMING.tipFadeMs)) * fade,
    settled: clamp01(arrivedFor / TIMING.tipFadeMs),
    pulse: arrivedFor >= 0 && arrivedFor < LOOK.pulseMs ? arrivedFor / LOOK.pulseMs : null,
    label: labelOpacity(route, arrivedFor) * fade,
  };
}

const LOOK = HOME_MAP.routes;

function labelOpacity(route: Route, arrivedFor: number): number {
  if (arrivedFor < 0) return 0;
  const shown = clamp01(arrivedFor / LOOK.labelFadeMs);
  if (route.kind !== "ambient") return shown;
  return Math.min(shown, 1 - clamp01((arrivedFor - LOOK.labelMs) / LOOK.labelFadeMs));
}

export type Wanted = { selected: string | null; preview: string | null };

/**
 * The chosen city and the previewed chip become priority routes from the origin; a city let go fades. Unknown codes
 * and the origin's own city draw nothing. Ambient routes give way when the priority routes fill `maxRoutes` (on a
 * phone the one route is the chosen city's).
 */
export function setWanted(scene: Scene, wanted: Wanted, destinations: ReadonlyMap<string, Place>, now: number): void {
  const want = new Map<string, RouteKind>();
  if (wanted.selected && wanted.selected !== scene.origin.code && destinations.has(wanted.selected)) want.set(wanted.selected, "selected");
  if (wanted.preview && wanted.preview !== scene.origin.code && destinations.has(wanted.preview) && !want.has(wanted.preview))
    want.set(wanted.preview, "preview");

  for (const route of scene.routes) {
    if (route.kind === "ambient" || route.leaving !== undefined) continue;
    const kind = want.get(route.code);
    if (kind) {
      route.kind = kind;
      want.delete(route.code);
    } else route.leaving = now;
  }
  for (const [code, kind] of want) {
    // The same city drawn as an ambient route right now becomes the priority one, without starting over.
    const ambient = scene.routes.find((r) => r.kind === "ambient" && r.code === code && r.leaving === undefined && !isGone(r, now));
    if (ambient) {
      ambient.kind = kind;
      continue;
    }
    scene.routes.push(makeRoute(scene, destinations.get(code)!, kind, now));
  }
  makeRoom(scene, now);
}

function live(scene: Scene): Route[] {
  return scene.routes.filter((r) => r.leaving === undefined);
}

/** Ambient routes fade, oldest first, until the live routes fit `maxRoutes`. */
function makeRoom(scene: Scene, now: number): void {
  let over = live(scene).length - scene.maxRoutes;
  for (const route of scene.routes) {
    if (over <= 0) break;
    if (route.kind === "ambient" && route.leaving === undefined) {
      route.leaving = Math.min(now, fadeStart(route));
      over--;
    }
  }
}

/**
 * Advances the scene to `now`: routes that have faded are dropped, and a new ambient route starts when there is room
 * and its pause is over. `candidates` are the destinations worth drawing (on screen, not too close to the origin).
 */
export function stepScene(scene: Scene, now: number, candidates: readonly Place[]): void {
  scene.routes = scene.routes.filter((r) => !isGone(r, now));
  // Fading routes still count, so a new one never crowds a route that is still visible.
  if (now < scene.nextSpawnAt || scene.routes.length >= scene.maxRoutes) return;

  const busy = new Set(scene.routes.map((r) => r.code));
  const fresh = candidates.filter((c) => c.code !== scene.origin.code && !busy.has(c.code) && !scene.recent.includes(c.code));
  const pool = fresh.length ? fresh : candidates.filter((c) => c.code !== scene.origin.code && !busy.has(c.code));
  if (!pool.length) {
    scene.nextSpawnAt = now + TIMING.gapMaxMs;
    return;
  }
  const to = pool[Math.floor(random(scene) * pool.length)];
  scene.routes.push(makeRoute(scene, to, "ambient", now));
  scene.recent = [to.code, ...scene.recent].slice(0, Math.min(6, Math.max(0, candidates.length - 2)));
  scene.nextSpawnAt = now + TIMING.gapMinMs + random(scene) * (TIMING.gapMaxMs - TIMING.gapMinMs);
}

/** The code of the chosen (else previewed) city drawn right now, if any. */
export function priorityCode(scene: Scene): string | null {
  const live = scene.routes.filter((r) => r.leaving === undefined);
  return (live.find((r) => r.kind === "selected") ?? live.find((r) => r.kind === "preview"))?.code ?? null;
}
