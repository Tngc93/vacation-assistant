/** Recolours the OpenFreeMap "positron" style with the design tokens. */

export const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/**
 * The map's only attribution, naming each source once. MapLibre's own
 * attribution control is not used: it also collects the tile server's
 * TileJSON credit at runtime, which repeated OpenFreeMap and OpenMapTiles.
 */
export const MAP_ATTRIBUTION: ReadonlyArray<{ label: string; href: string }> = [
  { label: "© OpenStreetMap katkıcıları", href: "https://www.openstreetmap.org/copyright" },
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
  { label: "© OpenMapTiles", href: "https://openmaptiles.org" },
];

export type MapPalette = {
  paper: string;
  paperRaised: string;
  ink: string;
  inkMuted: string;
  rule: string;
  sea: string;
  accent: string;
};

export const PALETTE_TOKENS: Record<keyof MapPalette, string> = {
  paper: "--paper",
  paperRaised: "--paper-raised",
  ink: "--ink",
  inkMuted: "--ink-muted",
  rule: "--rule",
  sea: "--sea",
  accent: "--accent",
};

type Layer = { id: string; type: string; paint?: Record<string, unknown> };
export type StylePatch = { layer: string; property: string; value: string | number };

/** Paint changes per base-map layer; applied once on load and again when the theme changes. */
export function stylePatches(layers: readonly Layer[], p: MapPalette): StylePatch[] {
  const patches: StylePatch[] = [];
  const set = (layer: string, property: string, value: string | number) => patches.push({ layer, property, value });

  for (const { id, type, paint = {} } of layers) {
    if (type === "background") set(id, "background-color", p.paper);
    else if (type === "fill" && id === "water") {
      set(id, "fill-color", p.sea);
      set(id, "fill-opacity", 0.28);
    } else if (type === "line" && id.startsWith("waterway")) set(id, "line-color", p.sea);
    else if (type === "fill" && /park|wood/.test(id)) {
      set(id, "fill-color", p.rule);
      set(id, "fill-opacity", 0.45);
    } else if (type === "fill" && /building/.test(id)) {
      set(id, "fill-color", p.rule);
      set(id, "fill-opacity", 0.55);
      if ("fill-outline-color" in paint) set(id, "fill-outline-color", p.rule);
    } else if (type === "fill") set(id, "fill-color", p.paperRaised);
    else if (type === "line" && /boundary/.test(id)) set(id, "line-color", p.inkMuted);
    else if (type === "line" && /casing|dashline|aeroway/.test(id)) set(id, "line-color", p.rule);
    else if (type === "line") set(id, "line-color", p.paperRaised);
    else if (type === "symbol" && "text-color" in paint) {
      set(id, "text-color", /water/.test(id) ? p.sea : p.inkMuted);
      set(id, "text-halo-color", p.paper);
    }
  }
  return patches;
}

/** Applies patches to a style JSON object (before the map is created). */
export function applyPatches<T extends { layers: Layer[] }>(style: T, patches: readonly StylePatch[]): T {
  const byLayer = new Map<string, StylePatch[]>();
  for (const patch of patches) byLayer.set(patch.layer, [...(byLayer.get(patch.layer) ?? []), patch]);
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const own = byLayer.get(layer.id);
      if (!own) return layer;
      const paint = { ...(layer.paint ?? {}) };
      for (const patch of own) paint[patch.property] = patch.value;
      return { ...layer, paint };
    }),
  };
}
