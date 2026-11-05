import { describe, expect, it } from "vitest";
import file from "@/data/world-dots.json";
import { WORLD_DOTS_FILE_VERSION, WORLD_GRID, buildLandGrid, decodeBits, encodeBits, landDots, pointInPolygon, type Polygon } from "./worldDots";

const square: Polygon = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
  [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ],
];

describe("world dots", () => {
  it("knows inside, outside and holes", () => {
    expect(pointInPolygon(2, 2, square)).toBe(true);
    expect(pointInPolygon(5, 5, square)).toBe(false);
    expect(pointInPolygon(12, 2, square)).toBe(false);
  });

  it("round-trips the bitmask", () => {
    const bits = Array.from({ length: 37 }, (_, i) => i % 3 === 0 || i === 36);
    expect([...decodeBits(encodeBits(bits), bits.length)]).toEqual(bits.map(Number));
  });

  it("builds a grid from polygons", () => {
    const land = buildLandGrid([square], { lonMin: 0, latMax: 10, step: 2, cols: 5, rows: 5 });
    // The hole (4–6°) is the middle cell; the cells around it are land.
    expect(land[2 * 5 + 2]).toBe(false);
    expect(land[0]).toBe(true);
  });

  it("the stored grid is the documented one, with land where land is", () => {
    expect(file.version).toBe(WORLD_DOTS_FILE_VERSION);
    expect({ lonMin: file.lonMin, latMax: file.latMax, step: file.step, cols: file.cols, rows: file.rows }).toEqual(WORLD_GRID);
    const bits = decodeBits(file.bits, file.rows * file.cols);
    const at = (lat: number, lon: number) =>
      bits[Math.floor((file.latMax - lat) / file.step) * file.cols + Math.floor((lon - file.lonMin) / file.step)];
    expect(at(48.9, 2.4)).toBe(1); // Paris
    expect(at(39.9, 32.9)).toBe(1); // Ankara
    expect(at(-15, 25)).toBe(1); // Zambia
    expect(at(35, -40)).toBe(0); // the Atlantic
    expect(at(0, -140)).toBe(0); // the Pacific
  });

  it("thins the grid where the map is drawn smaller", () => {
    const all = landDots(file).length;
    const desktop = landDots(file, 2).length;
    const phone = landDots(file, 3).length;
    expect(all).toBeGreaterThan(50_000);
    expect(desktop).toBeLessThan(all / 3);
    expect(phone).toBeLessThan(desktop);
  });
});
