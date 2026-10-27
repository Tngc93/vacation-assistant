import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { SPREAD_KM, SPREAD_MIN_KM, spreadInside } from "./spread";

const kremlin = { id: "way/1", lat: 55.752, lon: 37.6175, wikidataId: "Q1" };
const cannon = { id: "node/3", lat: 55.75205, lon: 37.6177, wikidataId: "Q3", parentId: "Q1" };
const onTop = { id: "node/4", lat: 55.752, lon: 37.6175, wikidataId: "Q4", parentId: "Q1" };
const bell = { id: "node/2", lat: 55.7511, lon: 37.6176, wikidataId: "Q2", parentId: "Q1" };
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => distanceKm(a.lat, a.lon, b.lat, b.lon);

describe("spreadInside", () => {
  it("moves a child dot that would sit under its parent's, keeping its direction", () => {
    const [k, c, t, b] = spreadInside([kremlin, cannon, onTop, bell]);
    expect(k).toBe(kremlin);
    expect(km(kremlin, cannon)).toBeLessThan(SPREAD_MIN_KM);
    expect(km(k, c)).toBeCloseTo(SPREAD_KM, 3);
    expect(c.lon).toBeGreaterThan(kremlin.lon);
    expect(km(k, t)).toBeCloseTo(SPREAD_KM, 3);
    expect(km(c, t)).toBeGreaterThan(0.01);
    // Far enough already: unchanged.
    expect(b).toBe(bell);
  });

  it("leaves places without a listed parent alone", () => {
    expect(spreadInside([cannon])).toEqual([cannon]);
  });
});
