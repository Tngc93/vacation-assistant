import { describe, expect, it } from "vitest";
import { ISTANBUL } from "./origin";
import { TIMING, createScene, isGone, priorityCode, routeLook, setWanted, stepScene, type Place } from "./routes";

const PLACES: Place[] = [
  { code: "PAR", lat: 48.86, lon: 2.35 },
  { code: "ROM", lat: 41.89, lon: 12.48 },
  { code: "LON", lat: 51.51, lon: -0.13 },
  { code: "BCN", lat: 41.38, lon: 2.17 },
];
const MAP = new Map(PLACES.map((p) => [p.code, p]));

describe("home route scene", () => {
  it("starts an ambient route after a short pause and draws it in 2.5–4 s", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 3, now: 0 });
    stepScene(scene, 100, PLACES);
    expect(scene.routes).toHaveLength(0);
    stepScene(scene, 700, PLACES);
    expect(scene.routes).toHaveLength(1);
    const [route] = scene.routes;
    expect(route.kind).toBe("ambient");
    expect(route.drawMs).toBeGreaterThanOrEqual(TIMING.minDrawMs);
    expect(route.drawMs).toBeLessThanOrEqual(TIMING.maxDrawMs);
    expect(routeLook(route, 700).progress).toBe(0);
    expect(routeLook(route, 700 + route.drawMs).progress).toBe(1);
  });

  it("puts out the head on arrival and fades the route after holding it", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 1, now: 0 });
    stepScene(scene, 600, PLACES);
    const [route] = scene.routes;
    const arrived = route.start + route.drawMs;
    expect(routeLook(route, arrived - 1).tip).toBe(1);
    expect(routeLook(route, arrived + TIMING.tipFadeMs).tip).toBe(0);
    expect(routeLook(route, arrived + TIMING.holdMs).line).toBe(1);
    expect(isGone(route, arrived + TIMING.holdMs + TIMING.fadeMs)).toBe(true);
  });

  it("never shows more routes than allowed", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 2, now: 0 });
    for (let t = 0; t < 30_000; t += 33) {
      stepScene(scene, t, PLACES);
      expect(scene.routes.length).toBeLessThanOrEqual(2);
    }
  });

  it("is the same every time (seeded)", () => {
    const run = () => {
      const scene = createScene(ISTANBUL, { maxRoutes: 3, now: 0 });
      const codes: string[] = [];
      for (let t = 0; t < 20_000; t += 100) {
        stepScene(scene, t, PLACES);
        for (const r of scene.routes) if (!codes.includes(`${r.id}:${r.code}`)) codes.push(`${r.id}:${r.code}`);
      }
      return codes;
    };
    expect(run()).toEqual(run());
  });

  it("draws the chosen city as a priority route that stays while it is chosen", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 3, now: 0 });
    setWanted(scene, { selected: "PAR", preview: null }, MAP, 1000);
    expect(priorityCode(scene)).toBe("PAR");
    const route = scene.routes.find((r) => r.code === "PAR")!;
    expect(route.kind).toBe("selected");
    // Long after drawing it is still there, settled into a thin line.
    expect(isGone(route, 60_000)).toBe(false);
    expect(routeLook(route, 60_000).settled).toBe(1);
    expect(routeLook(route, 60_000).line).toBe(1);

    setWanted(scene, { selected: null, preview: null }, MAP, 61_000);
    expect(priorityCode(scene)).toBeNull();
    expect(isGone(route, 61_000 + TIMING.fadeMs)).toBe(true);
  });

  it("previews a chip and lets it go", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 3, now: 0 });
    setWanted(scene, { selected: null, preview: "ROM" }, MAP, 0);
    expect(priorityCode(scene)).toBe("ROM");
    expect(scene.routes[0].kind).toBe("preview");
    setWanted(scene, { selected: "ROM", preview: "ROM" }, MAP, 500);
    // The previewed route becomes the chosen one without starting over.
    expect(scene.routes).toHaveLength(1);
    expect(scene.routes[0]).toMatchObject({ kind: "selected", start: 0 });
  });

  it("on a phone, the chosen route is the only one", () => {
    const scene = createScene(ISTANBUL, { maxRoutes: 1, now: 0 });
    stepScene(scene, 600, PLACES);
    const ambient = scene.routes[0];
    setWanted(scene, { selected: ambient.code === "PAR" ? "ROM" : "PAR", preview: null }, MAP, 800);
    expect(ambient.leaving).toBe(800);
    for (let t = 800; t < 20_000; t += 100) stepScene(scene, t, PLACES);
    expect(scene.routes.map((r) => r.kind)).toEqual(["selected"]);
  });

  it("draws nothing for an unknown city or the origin itself", () => {
    const scene = createScene({ ...PLACES[0] }, { maxRoutes: 3, now: 0 });
    setWanted(scene, { selected: "PAR", preview: "XXX" }, MAP, 0);
    expect(scene.routes).toHaveLength(0);
  });
});
