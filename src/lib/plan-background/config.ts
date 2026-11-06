/**
 * Every tunable of the plan page's background in one place (DESIGN.md "Plan background"): the fixed atmosphere
 * behind the whole page, its gradient stand-in, the route strip under the site header and the graticule in the gaps between the
 * sections. Opacities are of the whole layer (the atmosphere) or of `--ink` (the graticule). Change values here; the
 * components pass them to `globals.css` as custom properties (`planBackgroundVars`).
 */
export const PLAN_BACKGROUND = {
  atmosphere: {
    /**
     * A fixed layer behind the whole plan page (it never moves with the scroll; only the Ken Burns drift moves it):
     * the hero and the gaps between the section cards show it. Opacity at its strongest point, over `--paper`.
     * Phones are lighter (`narrow`). Near it, text is `--ink` on its own surface (the route codes' badges).
     */
    opacityLight: 0.58,
    opacityDark: 0.5,
    /**
     * The masthead photo is drawn into a canvas this many pixels wide (its height follows the photo), recoloured in
     * the city's tritone, then scaled up to the viewport with a light CSS blur: soft silhouettes that still read as
     * a city. No new request: the canvas copies the masthead's own `<img>`.
     */
    canvasWidth: 256,
    blurPx: 5,
    /**
     * Where it shows (a mask over the viewport). Horizontally `leftLevel` of the full strength over the words' column
     * up to `rampFrom` of the width, full from `rampTo` (the photo and map column, above it and the right edge).
     * Vertically full over the top `topShare` of the viewport, easing to `bottomLevel` at its bottom. Phones (one
     * column; the hero and the sections are opaque cards there, so it shows only in the band above the top card, in
     * the gaps between the cards and in the gutters): no vertical fade, `leftLevel` over the gaps' coordinate at the
     * left (up to `quietRem`), full from `fullAt` of the width to the right edge.
     */
    leftLevel: 0.05,
    rampFrom: 0.585,
    rampTo: 0.72,
    topShare: 0.35,
    bottomLevel: 0.65,
    narrow: { opacityLight: 0.56, opacityDark: 0.48, leftLevel: 0.05, quietRem: 6.5, fullAt: 0.6 },
    /** Ken Burns: zoom to this scale and pan this far (share of the box), then back, ease-in-out. */
    drift: { scale: 1.04, panX: -0.015, panY: -0.01, seconds: 50 },
    /** Fade-in once the photo (or its stand-in) is ready. */
    fadeInMs: 700,
  },
  /**
   * The city's tone: the photo's colour decides it (`warmth` in tone.ts: red minus blue, weighted by saturation).
   * Above `warmAbove` (red outweighs blue) the tritone's middle is `--accent` (warm), else `--sea` (cool; a grey
   * photo too); the ends are `--ink` and `--paper`. Today: Barcelona +0.011 (warm), Oslo -0.072, Tokyo -0.256 (cool).
   */
  tone: { warmAbove: 0 },
  /**
   * Without a photo (none in the city's data, or it failed to load): a plain gradient from tokens, set by the city's
   * coordinates. The warm share of `--accent` grows towards the equator (none at `coolLat` and beyond, all of it at
   * `warmLat` and nearer); the light's angle and position follow the longitude.
   */
  gradient: { coolLat: 60, warmLat: 15, maxWarm: 0.55 },
  route: {
    /** The strip under the site header (keep in step with the hero's height in HeroExplorer). */
    heightRem: 1.75,
    /** The dashed `--accent` line draws once, in this long, then stays. */
    drawMs: 2000,
    width: 1.5,
    dash: 4,
    gap: 4,
  },
  graticule: {
    /** Lines of `--ink` at this opacity, only in the gaps between the sections. */
    opacity: 0.07,
    /** One meridian every this many rem; the parallel runs through the middle of the gap. */
    spacingRem: 6,
  },
} as const;

/** How warm the stand-in gradient is at a latitude: 0 (all `--sea`) to `maxWarm` (part `--accent`). */
export function warmShare(lat: number): number {
  const { coolLat, warmLat, maxWarm } = PLAN_BACKGROUND.gradient;
  const t = (coolLat - Math.abs(lat)) / (coolLat - warmLat);
  return Math.round(Math.min(1, Math.max(0, t)) * maxWarm * 100) / 100;
}

/** The stand-in gradient's custom properties for a city: tokens only, set by its coordinates. */
export function gradientVars(lat: number, lon: number): Record<string, string> {
  // Longitude -180…180 → the light from the left (west) to the right (east), and the slope of the wash with it.
  const x = Math.round(((lon + 180) / 360) * 100);
  const angle = Math.round(150 + (x - 50) * 0.6);
  return {
    "--pb-warm": `${Math.round(warmShare(lat) * 100)}%`,
    "--pb-sun-x": `${x}%`,
    "--pb-angle": `${angle}deg`,
  };
}

/** Everything `globals.css` reads for the atmosphere and the route strip, as custom properties. */
export function planBackgroundVars(): Record<string, string> {
  const { atmosphere: a, route: r, graticule: g } = PLAN_BACKGROUND;
  return {
    "--pb-opacity-light": String(a.opacityLight),
    "--pb-opacity-dark": String(a.opacityDark),
    "--pb-blur": `${a.blurPx}px`,
    "--pb-left": String(a.leftLevel),
    "--pb-ramp-from": `${a.rampFrom * 100}%`,
    "--pb-ramp-to": `${a.rampTo * 100}%`,
    "--pb-top": `${a.topShare * 100}%`,
    "--pb-bottom": String(a.bottomLevel),
    "--pb-narrow-opacity-light": String(a.narrow.opacityLight),
    "--pb-narrow-opacity-dark": String(a.narrow.opacityDark),
    "--pb-narrow-left": String(a.narrow.leftLevel),
    "--pb-narrow-quiet": `${a.narrow.quietRem}rem`,
    "--pb-narrow-full": `${a.narrow.fullAt * 100}%`,
    "--pb-drift-scale": String(a.drift.scale),
    "--pb-drift-x": `${a.drift.panX * 100}%`,
    "--pb-drift-y": `${a.drift.panY * 100}%`,
    "--pb-drift-duration": `${a.drift.seconds}s`,
    "--pb-fade-in": `${a.fadeInMs}ms`,
    "--pr-height": `${r.heightRem}rem`,
    "--pr-draw": `${r.drawMs}ms`,
    "--pr-width": `${r.width}px`,
    "--pr-dash": `${r.dash}px`,
    "--pr-gap": `${r.gap}px`,
    "--pg-opacity": `${g.opacity * 100}%`,
    "--pg-spacing": `${g.spacingRem}rem`,
  };
}
