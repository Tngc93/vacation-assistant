import { describe, expect, it } from "vitest";
import { easeInOut, greatCircle, isVisible, makeView, partialPath, pathLength, project, projectPath, wrapLon } from "./geo";

const IST = { lat: 41.01, lon: 28.96 };
const PAR = { lat: 48.86, lon: 2.35 };
const NYC = { lat: 40.71, lon: -74.01 };

describe("route map geometry", () => {
  it("wraps longitudes", () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(30)).toBe(30);
  });

  it("covers a desktop box with the latitude band and centres the chosen longitude", () => {
    const view = makeView(1440, 836, -12);
    expect(view.top).toBe(0);
    expect(project(view, { lat: 0, lon: -12 }).x).toBe(720);
    expect(isVisible(view, project(view, IST))).toBe(true);
    expect(isVisible(view, project(view, NYC))).toBe(true);
  });

  it("puts the focus latitude where a phone asks", () => {
    const view = makeView(375, 760, 16, { lat: 46, y: 700, scale: 7 });
    expect(project(view, { lat: 46, lon: 16 })).toEqual({ x: 187.5, y: 700 });
  });

  it("follows the great circle from end to end", () => {
    const path = greatCircle(IST, NYC, 32);
    expect(path).toHaveLength(33);
    expect(path[0].lat).toBeCloseTo(IST.lat, 6);
    expect(path[32].lon).toBeCloseTo(NYC.lon, 6);
    // The great circle bends north of both ends.
    expect(Math.max(...path.map((p) => p.lat))).toBeGreaterThan(50);
  });

  it("keeps a route across the edge of the view continuous", () => {
    const view = makeView(1440, 836, 0);
    const points = projectPath(view, greatCircle({ lat: 35, lon: 170 }, { lat: 35, lon: -170 }, 8));
    for (let i = 1; i < points.length; i++) expect(Math.abs(points[i].x - points[i - 1].x)).toBeLessThan(40);
  });

  it("draws part of a route up to its head", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(partialPath(line, 0.25)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect(pathLength(partialPath(line, 0.75))).toBeCloseTo(15);
    expect(partialPath(line, 1)).toEqual(line);
  });

  it("eases in and out", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(PAR.lat).toBeGreaterThan(IST.lat);
  });
});
