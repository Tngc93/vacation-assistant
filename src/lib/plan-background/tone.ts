import { PLAN_BACKGROUND } from "./config";

/** The plan atmosphere's tone: `--accent` for a warm photo, `--sea` for a cool one (DESIGN.md "Plan background"). */
export type PhotoTone = "warm" | "cool";

export type Rgb = readonly [number, number, number];

/**
 * How warm a photo's colour is, from RGBA pixels: the mean of red minus blue, each pixel weighted by its saturation
 * (grey pixels say nothing about the colour). About -1 (all blue) to 1 (all red); 0 for a grey photo.
 */
export function warmth(pixels: ArrayLike<number>): number {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    sum += ((r - b) / 255) * saturation;
    weight += saturation;
  }
  return weight === 0 ? 0 : sum / weight;
}

/** The one rule: warm above `warmAbove`, else cool (a grey photo is cool). */
export function photoTone(pixels: ArrayLike<number>): PhotoTone {
  return warmth(pixels) > PLAN_BACKGROUND.tone.warmAbove ? "warm" : "cool";
}

/** A token's computed value (six- or three-digit hex, or the rgb function form) as [r, g, b]; null for anything else. */
export function parseColour(value: string): Rgb | null {
  const v = value.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The tritone's three stops in a theme: the darker of `--ink` and `--paper` for the shadows, the city's tone for the
 * middle, the lighter one for the highlights. In the light theme the highlights are the paper itself; in the dark
 * one the shadows are, so the photo never turns into a negative and never repaints the page.
 */
export function tritoneStops(ink: Rgb, paper: Rgb, tone: Rgb): [dark: Rgb, mid: Rgb, light: Rgb] {
  return luma(ink) < luma(paper) ? [ink, tone, paper] : [paper, tone, ink];
}

/** Recolours RGBA pixels in place: each pixel's lightness picks a colour along dark → mid → light. */
export function applyTritone(pixels: Uint8ClampedArray, [dark, mid, light]: [Rgb, Rgb, Rgb]): void {
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const t = luma([pixels[i], pixels[i + 1], pixels[i + 2]]) / 255;
    const [a, b, k] = t < 0.5 ? [dark, mid, t * 2] : [mid, light, (t - 0.5) * 2];
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(a[c] + (b[c] - a[c]) * k);
  }
}
