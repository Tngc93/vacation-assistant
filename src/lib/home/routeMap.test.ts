import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setHomeRoute } from "./homeRoute";
import { HOME_MAP } from "./config";
import { project } from "./geo";
import { frameView, isLightColor, startRouteMap, type RouteMapEnv, type RouteMapHandle } from "./routeMap";

/** A 2D context that accepts every call and draws nothing (jsdom has no canvas). */
function fakeContext(calls: Record<string, unknown> = {}): CanvasRenderingContext2D {
  return new Proxy(calls, {
    get: (target, key) => (key in target ? target[key as string] : () => {}),
    set: (target, key, value) => {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

type Harness = {
  env: RouteMapEnv;
  /** The opacity of each fill of the still layer (land dots, then the destinations). */
  baseFills: number[];
  /** Every text drawn on the visible canvas. */
  texts: string[];
  frames: Map<number, (now: number) => void>;
  /** Each paint of the visible canvas starts with the dot layer. */
  paints: ReturnType<typeof vi.fn>;
  requestFrame: ReturnType<typeof vi.fn>;
  cancelFrame: ReturnType<typeof vi.fn>;
  setVisible: (visible: boolean) => void;
  /** Runs the pending frames at `now`, as the browser would. */
  runFrames: (now: number) => void;
};

function harness({ reducedMotion = false, saveData = false } = {}): Harness {
  const frames = new Map<number, (now: number) => void>();
  let next = 1;
  let onIntersection: (visible: boolean) => void = () => {};
  const requestFrame = vi.fn((cb: (now: number) => void) => {
    frames.set(next, cb);
    return next++;
  });
  const cancelFrame = vi.fn((h: number) => frames.delete(h));
  const paints = vi.fn();
  const texts: string[] = [];
  const main = fakeContext({ drawImage: paints, measureText: () => ({ width: 20 }), fillText: (t: string) => texts.push(t) });
  const baseFills: number[] = [];
  const baseCalls: Record<string, unknown> = {};
  const base = fakeContext(Object.assign(baseCalls, { fill: () => baseFills.push(baseCalls.globalAlpha as number) }));
  const env: RouteMapEnv = {
    requestFrame,
    cancelFrame,
    now: () => 0,
    matchMedia: (query) => ({
      matches: reducedMotion && query.includes("reduced-motion"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    saveData: () => saveData,
    context: (c) => (c === canvas ? main : base),
    observeIntersection: (_, onChange) => {
      onIntersection = onChange;
      return () => {};
    },
    observeResize: () => () => {},
  };
  return {
    env,
    baseFills,
    texts,
    frames,
    paints,
    requestFrame,
    cancelFrame,
    setVisible: (visible) => onIntersection(visible),
    runFrames: (now) => {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, cb] of pending) cb(now);
    },
  };
}

let canvas: HTMLCanvasElement;
let handle: RouteMapHandle | undefined;

beforeEach(() => {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 1440 });
  Object.defineProperty(container, "clientHeight", { value: 836 });
  canvas = document.createElement("canvas");
  container.append(canvas);
  document.body.append(container);
  setHomeRoute({ selected: null, preview: null });
});

afterEach(() => {
  handle?.stop();
  handle = undefined;
  document.body.innerHTML = "";
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.documentElement.style.removeProperty("--ink");
});

describe("home route map loop", () => {
  it("never starts an animation loop with reduced motion: the map is drawn once, still", () => {
    const h = harness({ reducedMotion: true });
    handle = startRouteMap(canvas, h.env);
    expect(h.requestFrame).not.toHaveBeenCalled();
    expect(canvas.dataset.motion).toBe("static");
    expect(canvas.dataset.ready).toBe("");
    // A chosen city draws no route either.
    setHomeRoute({ selected: "PAR" });
    expect(canvas.dataset.route).toBeUndefined();
    expect(h.requestFrame).not.toHaveBeenCalled();
  });

  it("still draws the map and the 68 destinations, at the theme's opacity", () => {
    document.documentElement.style.setProperty("--ink", "#16181d");
    let h = harness({ reducedMotion: true });
    handle = startRouteMap(canvas, h.env);
    expect(h.baseFills).toEqual([HOME_MAP.dots.opacityLight, HOME_MAP.cities.opacityLight]);
    handle.stop();

    document.documentElement.style.setProperty("--ink", "#ede7dc");
    h = harness({ reducedMotion: true });
    handle = startRouteMap(canvas, h.env);
    expect(h.baseFills).toEqual([HOME_MAP.dots.opacityDark, HOME_MAP.cities.opacityDark]);
  });

  it("stays still with a data saver", () => {
    const h = harness({ saveData: true });
    handle = startRouteMap(canvas, h.env);
    expect(h.requestFrame).not.toHaveBeenCalled();
    expect(handle.mode()).toBe("static");
  });

  it("runs at most ~30 frames a second", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    expect(canvas.dataset.motion).toBe("running");
    h.paints.mockClear();
    h.runFrames(1000);
    h.runFrames(1010); // too soon: skipped, but the loop goes on
    h.runFrames(1034);
    expect(h.paints).toHaveBeenCalledTimes(2);
    expect(h.frames.size).toBe(1);
  });

  it("stops while the tab is hidden and goes on when it is back", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    expect(h.frames.size).toBe(1);

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(h.cancelFrame).toHaveBeenCalled();
    expect(h.frames.size).toBe(0);
    expect(canvas.dataset.motion).toBe("paused");
    const requested = h.requestFrame.mock.calls.length;
    h.runFrames(2000);
    expect(h.requestFrame.mock.calls.length).toBe(requested);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(h.frames.size).toBe(1);
    expect(canvas.dataset.motion).toBe("running");
  });

  it("pauses off screen", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    h.setVisible(false);
    expect(h.frames.size).toBe(0);
    expect(canvas.dataset.motion).toBe("paused");
    h.setVisible(true);
    expect(h.frames.size).toBe(1);
  });

  it("draws a priority route to the city chosen in the search", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    setHomeRoute({ selected: "BCN" });
    expect(canvas.dataset.route).toBe("BCN");
    h.runFrames(100);
    expect(canvas.dataset.route).toBe("BCN");
    setHomeRoute({ selected: null });
    expect(canvas.dataset.route).toBeUndefined();
  });

  it("keeps the chosen route labelled with the origin's code and the city's", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    setHomeRoute({ selected: "ROM" });
    h.runFrames(HOME_MAP.timing.maxDrawMs + 1000);
    expect(h.texts).toEqual(expect.arrayContaining(["ROM", "IST"]));
    h.texts.length = 0;
    h.runFrames(60_000);
    expect(h.texts).toEqual(expect.arrayContaining(["ROM", "IST"]));
  });

  it("picks up a city chosen before the map loaded", () => {
    setHomeRoute({ selected: "ROM" });
    handle = startRouteMap(canvas, harness().env);
    expect(canvas.dataset.route).toBe("ROM");
  });

  it("stops everything when the page leaves", () => {
    const h = harness();
    handle = startRouteMap(canvas, h.env);
    handle.stop();
    expect(h.frames.size).toBe(0);
    setHomeRoute({ selected: "PAR" });
    expect(canvas.dataset.route).toBeUndefined();
  });
});

describe("home route map frame", () => {
  it("puts Europe, the Middle East and North Africa right of the hero text on desktop", () => {
    const { view, narrow } = frameView(1440, 836);
    expect(narrow).toBe(false);
    for (const [lat, lon] of [
      [41.01, 28.96], // İstanbul
      [41.9, 12.5], // Rome
      [51.5, -0.1], // London
      [30.0, 31.2], // Cairo
      [35.7, 51.4], // Tehran
    ]) {
      const p = project(view, { lat, lon });
      expect(p.x).toBeGreaterThan(720);
      expect(p.x).toBeLessThan(1440);
      expect(p.y).toBeGreaterThan(0);
    }
    // Tokyo lies outside: its route leaves the box.
    expect(project(view, { lat: 35.7, lon: 139.7 }).x).toBeGreaterThan(1440);
  });

  it("puts the same region in the band under the search on a phone", () => {
    const { view, narrow } = frameView(375, 1200);
    expect(narrow).toBe(true);
    for (const [lat, lon] of [
      [41.01, 28.96],
      [41.9, 12.5],
    ]) {
      const p = project(view, { lat, lon });
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(375);
      expect(p.y).toBeGreaterThan(1200 - 176);
    }
  });

  it("tells a dark theme by its light ink", () => {
    expect(isLightColor("#ede7dc")).toBe(true);
    expect(isLightColor("#16181d")).toBe(false);
    expect(isLightColor("rgb(237, 231, 220)")).toBe(true);
    expect(isLightColor("currentColor")).toBe(false);
  });
});
