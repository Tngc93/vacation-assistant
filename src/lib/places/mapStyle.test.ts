import { describe, expect, it } from "vitest";
import { applyPatches, MAP_ATTRIBUTION, stylePatches, type MapPalette } from "./mapStyle";

const palette: MapPalette = {
  paper: "PAPER",
  paperRaised: "RAISED",
  ink: "INK",
  inkMuted: "MUTED",
  rule: "RULE",
  sea: "SEA",
  accent: "ACCENT",
};

const layers = [
  { id: "background", type: "background", paint: { "background-color": "x" } },
  { id: "water", type: "fill", paint: { "fill-color": "x" } },
  { id: "park", type: "fill", paint: { "fill-color": "x" } },
  { id: "building", type: "fill", paint: { "fill-color": "x", "fill-outline-color": "x" } },
  { id: "highway_major_casing", type: "line", paint: { "line-color": "x" } },
  { id: "highway_minor", type: "line", paint: { "line-color": "x" } },
  { id: "boundary_2", type: "line", paint: { "line-color": "x" } },
  { id: "label_city", type: "symbol", paint: { "text-color": "x", "text-halo-color": "x" } },
  { id: "water_name_point_label", type: "symbol", paint: { "text-color": "x" } },
  { id: "highway-shield-non-us", type: "symbol", paint: {} },
];

describe("map recolouring", () => {
  const style = applyPatches({ version: 8, layers }, stylePatches(layers, palette));
  const paint = (id: string) => style.layers.find((l) => l.id === id)!.paint;

  it("maps base layers to tokens: paper land, sea water, muted roads, muted labels", () => {
    expect(paint("background")).toEqual({ "background-color": "PAPER" });
    expect(paint("water")).toEqual({ "fill-color": "SEA", "fill-opacity": 0.28 });
    expect(paint("park")?.["fill-color"]).toBe("RULE");
    expect(paint("building")).toMatchObject({ "fill-color": "RULE", "fill-outline-color": "RULE" });
    expect(paint("highway_major_casing")).toEqual({ "line-color": "RULE" });
    expect(paint("highway_minor")).toEqual({ "line-color": "RAISED" });
    expect(paint("boundary_2")).toEqual({ "line-color": "MUTED" });
    expect(paint("label_city")).toEqual({ "text-color": "MUTED", "text-halo-color": "PAPER" });
    expect(paint("water_name_point_label")?.["text-color"]).toBe("SEA");
  });

  it("drops the road-number shields", () => {
    expect(style.layers.map((l) => l.id)).not.toContain("highway-shield-non-us");
    expect(style.layers).toHaveLength(layers.length - 1);
  });

  it("does not mutate the original style", () => {
    expect(layers[0].paint).toEqual({ "background-color": "x" });
  });

  it("credits each source exactly once", () => {
    const text = MAP_ATTRIBUTION.map((a) => a.label).join(" · ");
    expect(text).toBe("© OpenStreetMap katkıcıları · OpenFreeMap · © OpenMapTiles");
    for (const name of ["OpenStreetMap", "OpenFreeMap", "OpenMapTiles"]) expect(text.split(name)).toHaveLength(2);
    expect(MAP_ATTRIBUTION[0].href).toBe("https://www.openstreetmap.org/copyright");
  });
});
