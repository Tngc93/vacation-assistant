import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { gradientVars, PLAN_BACKGROUND, planBackgroundVars, warmShare } from "./config";

const city = (code: string) => DESTINATIONS.find((d) => d.cityCode === code)!;

describe("plan background config", () => {
  it("keeps the atmosphere low and the motion slow (DESIGN.md: 3–5% over 40–60 s, ~70% fade)", () => {
    const a = PLAN_BACKGROUND.atmosphere;
    for (const opacity of [a.opacityLight, a.opacityDark]) expect(opacity).toBeLessThanOrEqual(0.5);
    expect(a.drift.scale).toBeGreaterThanOrEqual(1.03);
    expect(a.drift.scale).toBeLessThanOrEqual(1.05);
    expect(a.drift.seconds).toBeGreaterThanOrEqual(40);
    expect(a.drift.seconds).toBeLessThanOrEqual(60);
    expect(1 - a.solidShare).toBeCloseTo(0.7, 1);
    expect(PLAN_BACKGROUND.graticule.opacity).toBeGreaterThanOrEqual(0.05);
    expect(PLAN_BACKGROUND.graticule.opacity).toBeLessThanOrEqual(0.08);
  });

  it("passes every tunable to the CSS as a plain value, never a colour", () => {
    const vars = planBackgroundVars();
    expect(vars["--pb-drift-duration"]).toBe(`${PLAN_BACKGROUND.atmosphere.drift.seconds}s`);
    expect(vars["--pr-draw"]).toBe(`${PLAN_BACKGROUND.route.drawMs}ms`);
    for (const [name, value] of Object.entries(vars)) {
      expect(name).toMatch(/^--p[bgr]-/);
      expect(value).toMatch(/^-?[\d.]+(px|rem|ms|s|%)?$/);
    }
  });
});

describe("the gradient without a photo", () => {
  it("is cool in the north and warmer towards the equator", () => {
    expect(warmShare(city("OSL").lat)).toBe(0);
    expect(warmShare(city("BCN").lat)).toBeGreaterThan(0);
    expect(warmShare(city("DXB").lat)).toBeGreaterThan(warmShare(city("BCN").lat));
    expect(warmShare(city("SIN").lat)).toBe(PLAN_BACKGROUND.gradient.maxWarm);
    expect(warmShare(-city("SIN").lat)).toBe(warmShare(city("SIN").lat));
  });

  it("follows the longitude with its light, and is the same for the same city every time", () => {
    const ams = city("AMS");
    const tyo = city("TYO");
    const a = gradientVars(ams.lat, ams.lon);
    expect(a).toEqual(gradientVars(ams.lat, ams.lon));
    expect(parseFloat(gradientVars(tyo.lat, tyo.lon)["--pb-sun-x"])).toBeGreaterThan(parseFloat(a["--pb-sun-x"]));
    // Only shares and angles: the colours themselves are tokens in globals.css.
    for (const value of Object.values(a)) expect(value).toMatch(/^-?\d+(%|deg)$/);
  });
});
