/**
 * Every tunable of the plan page's background in one place (DESIGN.md "Plan background"): the atmosphere behind the
 * hero, its gradient stand-in, the route strip under the site header and the graticule in the gaps between the
 * sections. Opacities are of the whole layer (the atmosphere) or of `--ink` (the graticule). Change values here; the
 * components pass them to `globals.css` as custom properties (`planBackgroundVars`).
 */
export const PLAN_BACKGROUND = {
  atmosphere: {
    /**
     * The whole layer, over `--paper`. In the light theme the duotone is mostly the light tone, so it needs a little
     * more to show at all; the words sit on their own paper scrims either way.
     */
    opacityLight: 0.4,
    opacityDark: 0.36,
    /**
     * The masthead photo is drawn into a canvas this many pixels wide (its height follows the photo), then scaled
     * up behind the hero: the downscale already blurs, the CSS blur below only smooths what is left. No new request:
     * the canvas copies the masthead's own `<img>`.
     */
    canvasWidth: 64,
    blurPx: 28,
    /** Solid over the top share of its height, then fading softly into `--paper` over the rest (~70%). */
    solidShare: 0.3,
    /** Ken Burns: zoom to this scale and pan this far (share of the box), then back, ease-in-out. */
    drift: { scale: 1.04, panX: -0.015, panY: -0.01, seconds: 50 },
    /** Fade-in once the photo (or its stand-in) is ready. */
    fadeInMs: 700,
  },
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
    "--pb-solid": `${a.solidShare * 100}%`,
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
