/**
 * The home page's route map on a canvas (DESIGN.md "Home background"): the dot map and the 68 destinations, the routes
 * of src/lib/home/routes.ts, the dots near the pointer stronger. Every value comes from src/lib/home/config.ts. Loaded by HomeBackground only when the browser is idle after the first
 * paint, so it never delays the hero.
 *
 * Runs at most ~30 frames a second and only while it is useful: never with reduced motion or a data saver (the map
 * is drawn once, still, without routes), and paused while the tab is hidden or the map is off screen.
 */
import worldDots from "@/data/world-dots.json";
import { DESTINATIONS } from "@/data/destinations";
import { readRememberedOrigin } from "@/data/origins";
import { HOME_MAP } from "./config";
import { isVisible, makeView, partialPath, project, projectPath, type Point, type View } from "./geo";
import { getHomeRoute, subscribeHomeRoute } from "./homeRoute";
import { homeOrigin } from "./origin";
import { createScene, priorityCode, routeLook, setWanted, stepScene, type Place, type Scene } from "./routes";
import { landDots, type Dot, type WorldDotsFile } from "./worldDots";

const CONFIG = HOME_MAP;
const FRAME_MS = 1000 / CONFIG.fps;
const NEAR_PX = CONFIG.pointer.radiusPx;
/** The pointer's glow is drawn in this many steps of strength. */
const GLOW_STEPS = 8;

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
  /** Dots by pointer-radius bucket, for the pointer's neighbourhood. */
  buckets: Map<number, number[]>;
  /** The destinations inside the box, x and y interleaved. */
  cities: Float32Array;
  dpr: number;
  narrow: boolean;
  candidates: Place[];
};

const BUCKET_COLS = 1 << 12;
const bucketKey = (bx: number, by: number) => (by + 64) * BUCKET_COLS + (bx + 64);

/** The view of config `frame`: Europe, the Middle East and North Africa right of the text, or under the search. */
export function frameView(width: number, height: number): { view: View; narrow: boolean } {
  const { desktop, phone, narrowPx } = CONFIG.frame;
  if (width < narrowPx) {
    return { narrow: true, view: makeView(width, height, { ...phone, x: width * phone.x, y: height - phone.yFromBottom }) };
  }
  const scale = Math.min(desktop.maxScale, Math.max(desktop.minScale, width / desktop.widthDegrees));
  return { narrow: false, view: makeView(width, height, { ...desktop, x: width * desktop.x, y: height * desktop.y, scale }) };
}

function layoutFor(width: number, height: number, dpr: number, origin: Place): Layout {
  const { view, narrow } = frameView(width, height);
  const device = narrow ? "phone" : "desktop";
  const file = worldDots as WorldDotsFile;
  const every = Math.min(8, Math.max(1, Math.round(CONFIG.dots.spacingPx[device] / (view.scale * file.step))));
  const dots: Dot[] = landDots(file, every);
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
  const cities: number[] = [];
  for (const d of DESTINATION_PLACES) {
    const p = project(view, d);
    if (isVisible(view, p, -4)) cities.push(p.x, p.y);
  }
  const originPoint = project(view, origin);
  const minLength = CONFIG.routes.minLengthPx[device];
  // On desktop far cities (Tokyo, New York) are drawn too, as routes leaving the box; a phone's one route stays inside.
  const candidates = DESTINATION_PLACES.filter((d) => {
    const p = project(view, d);
    if (d.code === origin.code || Math.hypot(p.x - originPoint.x, p.y - originPoint.y) < minLength) return false;
    return narrow ? isVisible(view, p, 24) : true;
  });
  return { view, points: points.subarray(0, n * 2), buckets, cities: new Float32Array(cities), dpr, narrow, candidates };
}

type Colors = { ink: string; accent: string; paper: string; dark: boolean; mono: string };

/** A dark theme has light ink: the relative luminance of `--ink` (hex or rgb) above one half. */
export function isLightColor(color: string): boolean {
  let rgb: number[] | null = null;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = color.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (m) rgb = [m[1], m[2], m[3]].map(Number);
  }
  if (!rgb) return false;
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const ink = read("--ink") || "currentColor";
  return {
    ink,
    accent: read("--accent") || "currentColor",
    paper: read("--paper") || "transparent",
    dark: isLightColor(ink),
    mono: read("--font-geist-mono") || "ui-monospace, monospace",
  };
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

/** Cumulative lengths along a polyline (first 0, last its length). */
function partialLengths(points: readonly Point[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return out;
}

/** The part of a polyline between shares `from` and `to` of its length. */
function slice(points: readonly Point[], lengths: readonly number[], from: number, to: number): Point[] {
  const total = lengths[lengths.length - 1];
  const at = (d: number): Point => {
    for (let i = 1; i < points.length; i++) {
      if (lengths[i] >= d) {
        const step = lengths[i] - lengths[i - 1];
        const k = step ? (d - lengths[i - 1]) / step : 0;
        return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k };
      }
    }
    return points[points.length - 1];
  };
  const a = from * total;
  const b = to * total;
  const out = [at(a)];
  for (let i = 1; i < points.length - 1; i++) if (lengths[i] > a && lengths[i] < b) out.push(points[i]);
  out.push(at(b));
  return out;
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
  let scene: Scene = createScene(origin, { maxRoutes: CONFIG.routes.max.desktop, now: env.now() });
  const pointer = { x: 0, y: 0, active: false, near: 0 };

  const setData = (key: string, value: string | null) => {
    if (value === null) delete canvas.dataset[key];
    else if (canvas.dataset[key] !== value) canvas.dataset[key] = value;
  };

  const running = () => !still && pageVisible && onScreen;
  const mode = (): MotionMode => (still ? "static" : running() ? "running" : "paused");

  const device = () => (layout?.narrow ? "phone" : "desktop");
  const maxRoutes = () => CONFIG.routes.max[device()];

  function drawBase() {
    if (!ctx || !layout) return;
    const { view, dpr, points, cities } = layout;
    base ??= document.createElement("canvas");
    base.width = canvas.width;
    base.height = canvas.height;
    const b = env.context(base);
    if (!b) return;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, view.width, view.height);
    b.fillStyle = colors.ink;
    b.globalAlpha = colors.dark ? CONFIG.dots.opacityDark : CONFIG.dots.opacityLight;
    dotsPath(b, points, null, CONFIG.dots.radius[device()]);
    b.fill();
    // The 68 destinations, a little stronger and larger.
    b.globalAlpha = colors.dark ? CONFIG.cities.opacityDark : CONFIG.cities.opacityLight;
    dotsPath(b, cities, null, CONFIG.cities.radius[device()]);
    b.fill();
    b.globalAlpha = 1;
  }

  function relayout() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    layout = layoutFor(width, height, dpr, origin);
    scene.maxRoutes = maxRoutes();
    drawBase();
    paint(env.now());
  }

  /** The city's code in mono, beside it and inside the box. */
  function label(text: string, at: Point, alpha: number) {
    if (!ctx || !layout || alpha <= 0.01) return;
    const size = CONFIG.routes.labelSize[device()];
    ctx.font = `500 ${size}px ${colors.mono}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.08em";
    const width = ctx.measureText(text).width;
    const pad = 8;
    let x = at.x + pad;
    if (x + width > layout.view.width - 4) x = at.x - pad - width;
    const y = Math.min(layout.view.height - 4, Math.max(size + 2, at.y - pad));
    ctx.textBaseline = "alphabetic";
    // A paper halo keeps the code legible over dots and other routes.
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.paper;
    ctx.setLineDash([]);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = colors.ink;
    ctx.globalAlpha = alpha * CONFIG.routes.labelOpacity;
    ctx.fillText(text, x, y);
  }

  /** The last `length` pixels of a polyline, head last. */
  function tail(points: readonly Point[], length: number): Point[] {
    const out: Point[] = [points[points.length - 1]];
    let left = length;
    for (let i = points.length - 1; i > 0 && left > 0; i--) {
      const a = points[i];
      const b = points[i - 1];
      const step = Math.hypot(a.x - b.x, a.y - b.y);
      if (step >= left) {
        const k = left / step;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        break;
      }
      out.push(b);
      left -= step;
    }
    return out.reverse();
  }

  function paint(now: number) {
    if (!ctx || !layout || !base) return;
    const { view, dpr } = layout;
    const R = CONFIG.routes;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    if (still) {
      canvas.dataset.ready = "";
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dots near the pointer: up to `boost` times their own opacity and a little larger, softly towards the edge.
    if (pointer.near > 0.01) {
      const rect = canvas.getBoundingClientRect();
      const px = pointer.x - rect.left;
      const py = pointer.y - rect.top;
      const bx = Math.floor(px / NEAR_PX);
      const by = Math.floor(py / NEAR_PX);
      const own = colors.dark ? CONFIG.dots.opacityDark : CONFIG.dots.opacityLight;
      const radius = CONFIG.dots.radius[device()];
      const { points } = layout;
      // Grouped in a few steps of strength, one fill each, however many dots are near.
      const steps: number[][] = Array.from({ length: GLOW_STEPS }, () => []);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const i of layout.buckets.get(bucketKey(bx + dx, by + dy)) ?? []) {
            const d = Math.hypot(layout.points[i * 2] - px, layout.points[i * 2 + 1] - py);
            if (d >= NEAR_PX) continue;
            const t = 1 - d / NEAR_PX;
            const step = Math.round(t * t * (3 - 2 * t) * GLOW_STEPS) - 1;
            if (step >= 0) steps[step].push(i);
          }
        }
      }
      ctx.fillStyle = colors.ink;
      steps.forEach((indices, step) => {
        if (!indices.length) return;
        const k = ((step + 1) / GLOW_STEPS) * pointer.near;
        // Over the dot already drawn at `own`: together they reach own × (1 + (boost − 1) k).
        const target = Math.min(0.95, own * (1 + (CONFIG.pointer.boost - 1) * k));
        ctx.globalAlpha = 1 - (1 - target) / (1 - own);
        dotsPath(ctx, points, indices, radius + CONFIG.pointer.grow * k);
        ctx.fill();
      });
    }

    const originPoint = project(view, origin);
    if (scene.routes.length && isVisible(view, originPoint)) {
      ctx.globalAlpha = CONFIG.origin.opacity;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = CONFIG.origin.lineWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(originPoint.x, originPoint.y, CONFIG.origin.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ambient routes first, the chosen or previewed one over them.
    const ordered = [...scene.routes].sort((a, b) => Number(a.kind !== "ambient") - Number(b.kind !== "ambient"));
    let originLabel = 0;
    for (const route of ordered) {
      const look = routeLook(route, now);
      if (look.line <= 0) continue;
      const priority = route.kind !== "ambient";
      const full = projectPath(view, route.path);
      const points = partialPath(full, look.progress);
      const head = points[points.length - 1];
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = colors.accent;
      ctx.setLineDash(R.dash);
      ctx.lineWidth = priority ? R.priorityWidth : R.width;
      ctx.globalAlpha = look.line * (priority ? R.priorityOpacity : R.opacity);
      polyline(ctx, points);
      ctx.stroke();

      // While drawing: a short solid trail behind the head, fading towards its tail.
      if (look.progress < 1 && look.progress > 0) {
        const trail = tail(points, R.trailPx);
        const slices = R.trailSlices;
        const length = trail.length > 1 ? partialLengths(trail) : null;
        ctx.setLineDash([]);
        ctx.lineWidth = priority ? R.priorityWidth + 0.5 : R.trailWidth;
        if (length) {
          for (let s = 0; s < slices; s++) {
            ctx.globalAlpha = look.line * ((s + 1) / slices);
            polyline(ctx, slice(trail, length, s / slices, (s + 1) / slices));
            ctx.stroke();
          }
        }
      }

      const end = full[full.length - 1];
      const endVisible = isVisible(view, end);
      if (look.tip > 0.01) {
        ctx.setLineDash([]);
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = look.tip;
        ctx.beginPath();
        ctx.arc(head.x, head.y, R.tipRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (look.pulse !== null && endVisible) {
        ctx.setLineDash([]);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = R.pulseOpacity * (1 - look.pulse) * look.line;
        ctx.beginPath();
        ctx.arc(end.x, end.y, R.tipRadius + (R.pulseRadius - R.tipRadius) * look.pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (priority && look.progress >= 1 && endVisible) {
        // A chosen city keeps a small accent dot where its route ends.
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = look.line;
        ctx.beginPath();
        ctx.arc(end.x, end.y, R.tipRadius - 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (endVisible) label(route.code, end, look.label);
      if (priority) originLabel = Math.max(originLabel, look.label);
    }
    if (originLabel > 0 && isVisible(view, originPoint)) label(origin.code, originPoint, originLabel);
    ctx.globalAlpha = 1;
    canvas.dataset.ready = "";
  }

  function frame(now: number) {
    if (!layout) return;
    const dt = Math.min(200, now - (Number.isFinite(lastFrame) ? lastFrame : now));
    pointer.near += ((pointer.active ? 1 : 0) - pointer.near) * (1 - Math.exp(-dt / CONFIG.pointer.easeMs));
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
    scene = createScene(origin, { maxRoutes: maxRoutes(), now: env.now() });
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
