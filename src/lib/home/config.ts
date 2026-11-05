/**
 * Every tunable of the home page's route map in one place (DESIGN.md "Home background"): framing, dots, cities,
 * routes, timing and the pointer. Opacities are of `--ink` unless named; routes are `--accent`. Change values here,
 * not in the engine.
 */
export const HOME_MAP = {
  frame: {
    /**
     * Desktop: Europe, the Middle East and North Africa right of the hero text. `lat`/`lon` is drawn at `x`, `y`
     * (shares of the box); the scale is `width / widthDegrees` CSS pixels per degree, between `minScale` and
     * `maxScale`. Far destinations (Tokyo, New York) lie outside; their routes leave the box.
     */
    desktop: { lat: 44, lon: 20, x: 0.75, y: 0.33, widthDegrees: 130, minScale: 8, maxScale: 13 },
    /** Phones: the same region in the band under the search; `y` is pixels above the bottom of the box. */
    phone: { lat: 47, lon: 17, x: 0.5, yFromBottom: 100, scale: 7 },
    /** Under this width the phone frame and phone values apply. */
    narrowPx: 768,
  },
  dots: {
    /** Opacity of `--ink`: the continents read at a glance. */
    opacityLight: 0.2,
    opacityDark: 0.25,
    radius: { desktop: 1.35, phone: 1.25 },
    /**
     * About one dot this many CSS pixels apart: every n-th cell of the half-degree grid, n rounded, so the real
     * spacing is a multiple of half a degree at the frame's scale (~5.5 px at 1440 px, 7 px on a phone).
     */
    spacingPx: { desktop: 6, phone: 7 },
  },
  cities: {
    /** The 68 destinations, a little stronger and larger than the land dots. */
    opacityLight: 0.38,
    opacityDark: 0.45,
    radius: { desktop: 2.2, phone: 1.9 },
  },
  origin: { opacity: 0.6, radius: 3, lineWidth: 1.25 },
  routes: {
    /** Ambient routes, `--accent`. */
    width: 1.5,
    opacity: 0.7,
    /** The chosen city or a previewed chip: thicker and fully opaque. */
    priorityWidth: 2.25,
    priorityOpacity: 1,
    dash: [4, 4] as readonly number[],
    /** While drawing, a short solid trail behind the head, fading towards its tail. */
    trailPx: 70,
    trailSlices: 8,
    trailWidth: 2,
    tipRadius: 3.5,
    /** On arrival a small ring opens from the city and fades. */
    pulseMs: 900,
    pulseRadius: 16,
    pulseOpacity: 0.7,
    /** The city's code (mono, uppercase) beside it on arrival. */
    labelMs: 1600,
    labelFadeMs: 350,
    labelOpacity: 0.85,
    labelSize: { desktop: 11, phone: 10 },
    /** At most this many routes at once, chosen and previewed ones included. */
    max: { desktop: 4, phone: 1 },
    /** A destination closer to the origin than this (CSS px) is not drawn as an ambient route. */
    minLengthPx: { desktop: 60, phone: 45 },
  },
  timing: {
    /** Drawing a route: the shortest hop takes `minDrawMs`, anything past ~60° `maxDrawMs`, ease-in-out. */
    minDrawMs: 3000,
    maxDrawMs: 5000,
    /** An ambient route stays drawn this long after arriving, then fades. */
    holdMs: 1700,
    fadeMs: 1200,
    /** The accent dot at the head goes out after arrival. */
    tipFadeMs: 700,
    /** Pause between two ambient routes. */
    gapMinMs: 900,
    gapMaxMs: 2000,
    /** The first ambient route, after the map appears. */
    firstMs: 600,
  },
  pointer: {
    /** Dots within this many CSS pixels of the pointer or a touch grow stronger, most at the centre. */
    radiusPx: 140,
    /** Opacity at the centre, as a multiple of the dots' own. */
    boost: 2.2,
    /** And a little larger there (CSS px). */
    grow: 0.6,
    /** How fast the glow follows the pointer arriving or leaving (time constant, ms). */
    easeMs: 180,
  },
  /** Frame rate cap and device pixel ratio cap. */
  fps: 30,
  maxDpr: 2,
} as const;
