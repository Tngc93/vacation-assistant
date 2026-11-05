import { describe, expect, it } from "vitest";
import { applyTritone, parseColour, photoTone, tritoneStops, warmth, type Rgb } from "./tone";

/** RGBA pixels of one colour. */
const fill = (rgb: Rgb, n = 16) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4]));
const mix = (...parts: Uint8ClampedArray[]) => Uint8ClampedArray.from(parts.flatMap((p) => [...p]));

const INK: Rgb = [22, 24, 29];
const PAPER: Rgb = [244, 239, 230];
const ACCENT: Rgb = [184, 73, 42];

describe("the city's tone from its photo", () => {
  it("calls sandstone and terracotta warm, sky and fjord cool", () => {
    expect(photoTone(fill([196, 150, 110]))).toBe("warm");
    expect(photoTone(fill([90, 130, 170]))).toBe("cool");
  });

  it("reads the colour, not the grey: a grey photo with a little warm colour is warm", () => {
    expect(warmth(fill([128, 128, 128]))).toBe(0);
    expect(photoTone(mix(fill([128, 128, 128], 200), fill([200, 140, 90], 8)))).toBe("warm");
  });

  it("a grey photo is cool", () => {
    expect(photoTone(mix(fill([0, 0, 0]), fill([255, 255, 255])))).toBe("cool");
  });

  it("weighs the scene's colour, not its size: more sky than city is still decided by both", () => {
    const sky = fill([150, 175, 205], 60);
    const city = fill([190, 120, 70], 40);
    expect(warmth(mix(sky, city))).toBeGreaterThan(warmth(sky));
  });
});

describe("tritone", () => {
  it("reads token colours in hex and rgb()", () => {
    expect(parseColour(" #16181d ")).toEqual([22, 24, 29]);
    expect(parseColour("#fff")).toEqual([255, 255, 255]);
    expect(parseColour("rgb(237, 231, 220)")).toEqual([237, 231, 220]);
    expect(parseColour("var(--x)")).toBeNull();
  });

  it("puts the darker of ink and paper on the shadows in either theme, never a negative", () => {
    expect(tritoneStops(INK, PAPER, ACCENT)).toEqual([INK, ACCENT, PAPER]);
    const darkInk: Rgb = [237, 231, 220];
    const darkPaper: Rgb = [15, 18, 22];
    expect(tritoneStops(darkInk, darkPaper, ACCENT)).toEqual([darkPaper, ACCENT, darkInk]);
  });

  it("maps black, mid grey and white to the three stops", () => {
    const pixels = mix(fill([0, 0, 0], 1), fill([128, 128, 128], 1), fill([255, 255, 255], 1));
    applyTritone(pixels, [INK, ACCENT, PAPER]);
    expect([...pixels.slice(0, 3)]).toEqual([...INK]);
    expect([...pixels.slice(4, 7)].map((v, i) => Math.abs(v - ACCENT[i]) <= 2)).toEqual([true, true, true]);
    expect([...pixels.slice(8, 11)]).toEqual([...PAPER]);
    expect(pixels[11]).toBe(255);
  });
});
