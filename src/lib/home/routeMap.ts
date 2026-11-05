/**
 * The home page's route map on a canvas (DESIGN.md "Home background"): the dot map, the routes of src/lib/home/routes.ts,
 * the dots near the pointer a little stronger. Loaded by HomeBackground only when the browser is idle after the first
 * paint, so it never delays the hero.
 *
 * Runs at most ~30 frames a second and only while it is useful: never with reduced motion or a data saver (the map
 * is drawn once, still, without routes), and paused while the tab is hidden or the map is off screen.
 */
import worldDots from "@/data/world-dots.json";
import { DESTINATIONS } from "@/data/destinations";
import { readRememberedOrigin } from "@/data/origins";
import { clamp01, isVisible, makeView, partialPath, project, projectPath, type Point, type View } from "./geo";
import { getHomeRoute, subscribeHomeRoute } from "./homeRoute";
import { homeOrigin } from "./origin";
import { createScene, priorityCode, routeLook, setWanted, stepScene, type Place, type Scene } from "./routes";
import { landDots, type Dot, type WorldDotsFile } from "./worldDots";

const FRAME_MS = 1000 / 30;
const MAX_DPR = 2;
/** Phones and narrow windows: a sparser grid and one route at a time. */
const NARROW_PX = 768;
/** Pointer proximity: dots within this many CSS pixels grow stronger, most at the centre. */
const NEAR_PX = 120;
/** How fast the proximity glow follows the pointer arriving or leaving (time constant, ms). */
const NEAR_EASE_MS = 180;

/** Opacities, all of `--ink` unless named (DESIGN.md: dots 6–10 %). */
const LOOK = {
  dot: 0.1,
  dotNear: 0.3,
  ambientLine: 0.32,
  priorityLine: 0.8,
  settledLine: 0.5,
  origin: 0.45,
} as const;

const DESTINATION_PLACES: Place[] = DESTINATIONS.map((d) => ({ code: d.cityCode, lat: d.lat, lon: d.lon }));
const DESTINATION_MAP = new Map(DESTINATION_PLACES.map((p) => [p.code, p]));

export type MotionMode = "static" | "running" | "paused";

/** What the browser offers; replaced in tests so no real frame or clock is involved (AGENTS.md "Zaman"). */
export type RouteMapEnv = {
  requestFrame: (callback: (now: number) => void) => number;
  cancelFrame: (handle: number) => void;
  now: () => number;
  matchMedia: (query: string) => Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
  saveData: () => boolean;
  /** A 2D context for a canvas; null where there is none (the map then stays empty). */
  context: (canvas: HTMLCanvasElement) => CanvasRenderingContext2D | null;
  observeIntersection: (element: Element, onChange: (visible: boolean) => void) => () => void;
  observeResize: (element: Element, onChange: () => void) => () => void;
};

export function browserEnv(): RouteMapEnv {
  return {
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (h) => window.cancelAnimationFrame(h),
    now: () => performance.now(),
    matchMedia: (q) => window.matchMedia(q),
    saveData: () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true,
    context: (canvas) => canvas.getContext("2d"),
    observeIntersection: (element, onChange) => {
      if (typeof IntersectionObserver === "undefined") return () => {};
      const io = new IntersectionObserver((entries) => onChange(entries.some((e) => e.isIntersecting)));
      io.observe(element);
      return () => io.disconnect();
    },
    observeResize: (element, onChange) => {
      if (typeof ResizeObserver === "undefined") return () => {};
      const ro = new ResizeObserver(() => onChange());
      ro.observe(element);
      return () => ro.disconnect();
    },
  };
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const REDUCED_DATA = "(prefers-reduced-data: reduce)";

/** Still map, no routes: reduced motion, a data saver, or reduced data asked for. */
export function wantsStill(env: Pick<RouteMapEnv, "matchMedia" | "saveData">): boolean {
  return env.matchMedia(REDUCED_MOTION).matches || env.matchMedia(REDUCED_DATA).matches || env.saveData();
}

type Layout = {
  view: View;
  /** Dot positions in CSS pixels, x and y interleaved. */
  points: Float32Array;
  /** Dots by 120 px bucket, for the pointer's neighbourhood. */
  buckets: Map<number, number[]>;
  radius: number;
  dpr: number;
  narrow: boolean;
  candidates: Place[];
};

const BUCKET_COLS = 1 << 12;
const bucketKey = (bx: number, by: number) => (by + 64) * BUCKET_COLS + (bx + 64);

function layoutFor(width: number, height: number, dpr: number, origin: Place): Layout {
  const narrow = width < NARROW_PX;
  // Europe and the Middle East sit right of the hero text on desktop, in the band under the search on a phone.
  const view = narrow ? makeView(width, height, 16, { lat: 46, y: height - 56, scale: 7 }) : makeView(width, height, -12);
  // About one dot every 13 px on desktop and 16 px on a phone, whatever the scale.
  const every = Math.min(4, Math.max(1, Math.round((narrow ? 16 : 13) / view.scale)));
  const dots: Dot[] = landDots(worldDots as WorldDotsFile, every);
  const points = new Float32Array(dots.length * 2);
  const buckets = new Map<number, number[]>();
  let n = 0;
  for (const dot of dots) {
    const p = project(view, dot);
    if (p.x < -4 || p.y < -4 || p.x > width + 4 || p.y > height + 4) continue;
    points[n * 2] = p.x;
    points[n * 2 + 1] = p.y;
    const key = bucketKey(Math.floor(p.x / NEAR_PX), Math.floor(p.y / NEAR_PX));
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(n);
    n++;
  }
  const originPoint = project(view, origin);
  const candidates = DESTINATION_PLACES.filter((d) => {
    const p = project(view, d);
    return d.code !== origin.code && isVisible(view, p, 16) && Math.hypot(p.x - originPoint.x, p.y - originPoint.y) >= (narrow ? 50 : 70);
  });
  return { view, points: points.subarray(0, n * 2), buckets, radius: narrow ? 1.2 : 1.4, dpr, narrow, candidates };
}

type Colors = { ink: string; accent: string };

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  return { ink: style.getPropertyValue("--ink").trim() || "currentColor", accent: style.getPropertyValue("--accent").trim() || "currentColor" };
}

function dotsPath(ctx: CanvasRenderingContext2D, points: Float32Array, indices: Iterable<number> | null, radius: number) {
  ctx.beginPath();
  const each = (i: number) => {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  };
  if (indices) for (const i of indices) each(i);
  else for (let i = 0; i < points.length / 2; i++) each(i);
}

function polyline(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

export type RouteMapHandle = { stop: () => void; mode: () => MotionMode };

/**
 * Starts the map on `canvas` (sized to its parent). Reflects its state on the canvas for tests and debugging:
 * `data-motion` ("static", "running", "paused") and `data-route` (the chosen or previewed city being drawn).
 */
export function startRouteMap(canvas: HTMLCanvasElement, env: RouteMapEnv = browserEnv()): RouteMapHandle {
  const ctx = env.context(canvas);
  const container = canvas.parentElement ?? canvas;
  const origin = homeOrigin(readRememberedOrigin());
  let still = wantsStill(env);
  let pageVisible = !document.hidden;
  let onScreen = true;
  let frameHandle = 0;
  let lastFrame = -Infinity;
  let layout: Layout | null = null;
  let base: HTMLCanvasElement | null = null;
  let colors = readColors();
  let scene: Scene = createScene(origin, { maxRoutes: 3, now: env.now() });
  const pointer = { x: 0, y: 0, active: false, near: 0 };

  const setData = (key: string, value: string | null) => {
    if (value === null) delete canvas.dataset[key];
    else if (canvas.dataset[key] !== value) canvas.dataset[key] = value;
  };

  const running = () => !still && pageVisible && onScreen;
  const mode = (): MotionMode => (still ? "static" : running() ? "running" : "paused");

  function drawBase() {
    if (!ctx || !layout) return;
    const { view, dpr, points, radius } = layout;
    base ??= document.createElement("canvas");
    base.width = canvas.width;
    base.height = canvas.height;
    const b = env.context(base);
    if (!b) return;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, view.width, view.height);
    b.fillStyle = colors.ink;
    b.globalAlpha = LOOK.dot;
    dotsPath(b, points, null, radius);
    b.fill();
  }

  function relayout() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    layout = layoutFor(width, height, dpr, origin);
    scene.maxRoutes = layout.narrow ? 1 : 3;
    drawBase();
    paint(env.now());
  }

  function paint(now: number) {
    if (!ctx || !layout || !base) return;
    const { view, dpr } = layout;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    if (still) {
      canvas.dataset.ready = "";
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dots near the pointer, a little stronger, softly towards the edge of the circle.
    if (pointer.near > 0.01) {
      const rect = canvas.getBoundingClientRect();
      const px = pointer.x - rect.left;
      const py = pointer.y - rect.top;
      const bx = Math.floor(px / NEAR_PX);
      const by = Math.floor(py / NEAR_PX);
      ctx.fillStyle = colors.ink;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const i of layout.buckets.get(bucketKey(bx + dx, by + dy)) ?? []) {
            const d = Math.hypot(layout.points[i * 2] - px, layout.points[i * 2 + 1] - py);
            if (d >= NEAR_PX) continue;
            const k = 1 - d / NEAR_PX;
            ctx.globalAlpha = LOOK.dotNear * k * k * pointer.near;
            dotsPath(ctx, layout.points, [i], layout.radius);
            ctx.fill();
          }
        }
      }
    }

    const originPoint = project(view, origin);
    if (scene.routes.length && isVisible(view, originPoint)) {
      ctx.globalAlpha = LOOK.origin;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(originPoint.x, originPoint.y, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const route of scene.routes) {
      const look = routeLook(route, now);
      if (look.line <= 0) continue;
      const priority = route.kind !== "ambient";
      const points = partialPath(projectPath(view, route.path), look.progress);
      ctx.setLineDash([3, 5]);
      ctx.lineCap = "round";
      ctx.strokeStyle = priority ? colors.accent : colors.ink;
      ctx.lineWidth = priority ? 1.5 - 0.5 * look.settled : 1;
      ctx.globalAlpha =
        look.line * (priority ? LOOK.priorityLine + (LOOK.settledLine - LOOK.priorityLine) * look.settled : LOOK.ambientLine);
      polyline(ctx, points);
      ctx.stroke();
      if (look.tip > 0.01) {
        const head = points[points.length - 1];
        // The head goes out on arrival, opening a little as it does.
        const r = 2.5 + 2 * clamp01(look.settled);
        ctx.setLineDash([]);
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = look.tip;
        ctx.beginPath();
        ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    canvas.dataset.ready = "";
  }

  function frame(now: number) {
    if (!layout) return;
    const dt = Math.min(200, now - (Number.isFinite(lastFrame) ? lastFrame : now));
    pointer.near += ((pointer.active ? 1 : 0) - pointer.near) * (1 - Math.exp(-dt / NEAR_EASE_MS));
    stepScene(scene, now, layout.candidates);
    setData("route", priorityCode(scene));
    paint(now);
  }

  function tick(now: number) {
    frameHandle = 0;
    if (!running()) return;
    if (now - lastFrame >= FRAME_MS - 1) {
      frame(now);
      lastFrame = now;
    }
    frameHandle = env.requestFrame(tick);
  }

  function update() {
    if (running()) {
      if (!frameHandle) frameHandle = env.requestFrame(tick);
    } else if (frameHandle) {
      env.cancelFrame(frameHandle);
      frameHandle = 0;
    }
    setData("motion", mode());
    if (still) setData("route", null);
  }

  const followWanted = () => {
    if (still || !layout) return;
    setWanted(scene, getHomeRoute(), DESTINATION_MAP, env.now());
    setData("route", priorityCode(scene));
  };

  const onPointerMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  };
  const onPointerEnd = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") pointer.active = false;
  };
  const onPointerOut = (e: PointerEvent) => {
    if (!e.relatedTarget) pointer.active = false;
  };
  const onBlur = () => (pointer.active = false);
  const onVisibility = () => {
    pageVisible = !document.hidden;
    update();
  };
  const onTheme = () => {
    colors = readColors();
    drawBase();
    paint(env.now());
  };
  const onStillChange = () => {
    const next = wantsStill(env);
    if (next === still) return;
    still = next;
    scene = createScene(origin, { maxRoutes: layout?.narrow ? 1 : 3, now: env.now() });
    followWanted();
    update();
    paint(env.now());
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  const themeObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(onTheme);
  themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const darkQuery = env.matchMedia("(prefers-color-scheme: dark)");
  darkQuery.addEventListener("change", onTheme);
  const motionQuery = env.matchMedia(REDUCED_MOTION);
  motionQuery.addEventListener("change", onStillChange);
  const unsubscribe = subscribeHomeRoute(followWanted);
  const stopIntersection = env.observeIntersection(canvas, (visible) => {
    onScreen = visible;
    update();
  });
  const stopResize = env.observeResize(container, relayout);

  relayout();
  followWanted();
  update();

  return {
    mode,
    stop() {
      if (frameHandle) env.cancelFrame(frameHandle);
      frameHandle = 0;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver?.disconnect();
      darkQuery.removeEventListener("change", onTheme);
      motionQuery.removeEventListener("change", onStillChange);
      unsubscribe();
      stopIntersection();
      stopResize();
    },
  };
}
