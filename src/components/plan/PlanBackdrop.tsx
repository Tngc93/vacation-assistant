"use client";

import { useEffect, useRef, useState } from "react";
import { gradientVars, PLAN_BACKGROUND } from "@/lib/plan-background/config";
import { applyTritone, parseColour, photoTone, tritoneStops, type PhotoTone } from "@/lib/plan-background/tone";

/** `pending` until the masthead photo has loaded; `gradient` without one, or when it fails. */
export type BackdropState = "pending" | "photo" | "gradient";

/** The masthead photo's `<img>` (CityPhoto); the backdrop copies it instead of asking the network again. */
export const CITY_PHOTO_SELECTOR = "img[data-city-photo]";

/**
 * Draws a loaded image into the canvas (`canvasWidth` px wide, the photo's own proportions) and returns its pixels,
 * untouched, for the tone and the recolouring. Null when the browser cannot draw or read it.
 */
export function drawSmall(canvas: HTMLCanvasElement, img: HTMLImageElement): ImageData | null {
  const width = PLAN_BACKGROUND.atmosphere.canvasWidth;
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Commons answers with CORS headers and the <img> asks with crossorigin, so the canvas stays readable.
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

/** The theme's `--ink`, `--paper` and the tone's token, as the page has them now. */
function themeStops(tone: PhotoTone) {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => parseColour(css.getPropertyValue(name));
  const [ink, paper, middle] = [read("--ink"), read("--paper"), read(tone === "warm" ? "--accent" : "--sea")];
  return ink && paper && middle ? tritoneStops(ink, paper, middle) : null;
}

/** Paints the source pixels into the canvas in the city's tritone for the current theme. */
function paint(canvas: HTMLCanvasElement, source: ImageData, tone: PhotoTone): boolean {
  const stops = themeStops(tone);
  const ctx = canvas.getContext("2d");
  if (!stops || !ctx) return false;
  const pixels = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  applyTritone(pixels.data, stops);
  ctx.putImageData(pixels, 0, 0);
  return true;
}

/** Calls back when the theme changes: the system preference or the site's own toggle (`html[data-theme]`). */
function onThemeChange(callback: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    query.removeEventListener("change", callback);
    observer.disconnect();
  };
}

/**
 * The plan hero's atmosphere (DESIGN.md "Plan background"): the masthead's city photo, recoloured in the city's
 * tritone (`--ink` → `--accent` for a warm photo or `--sea` for a cool one → `--paper`), softly blurred, full width
 * behind the hero; a mask keeps it strongest at the top right and almost paper behind the words. A plain gradient
 * from tokens, set by the city's coordinates, when there is no photo or it fails. Decoration only: hidden from
 * assistive technology, never focusable, never in the way of a click, not printed. A canvas, not a second `<img>`:
 * no new request, and it is never the page's largest paint. Its slow drift (Ken Burns) is CSS and stops with
 * reduced motion.
 */
export function PlanBackdrop({ hasPhoto, lat, lon }: { hasPhoto: boolean; lat: number; lon: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<BackdropState>(hasPhoto ? "pending" : "gradient");
  const [tone, setTone] = useState<PhotoTone | null>(null);

  useEffect(() => {
    if (!hasPhoto) return;
    const img = rootRef.current?.parentElement?.querySelector<HTMLImageElement>(CITY_PHOTO_SELECTOR);
    const canvas = canvasRef.current;
    let stopWatching: (() => void) | undefined;
    const show = () => {
      const source = img && canvas ? drawSmall(canvas, img) : null;
      if (!source || !canvas) return setState("gradient");
      const cityTone = photoTone(source.data);
      if (!paint(canvas, source, cityTone)) return setState("gradient");
      setTone(cityTone);
      setState("photo");
      stopWatching = onThemeChange(() => paint(canvas, source, cityTone));
    };
    const fail = () => setState("gradient");
    if (!img || !canvas || img.complete) show();
    else {
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", fail, { once: true });
    }
    return () => {
      img?.removeEventListener("load", show);
      img?.removeEventListener("error", fail);
      stopWatching?.();
    };
  }, [hasPhoto]);

  return (
    <div ref={rootRef} aria-hidden="true" data-plan-backdrop="" data-state={state} data-tone={tone ?? undefined} className="plan-backdrop print:hidden">
      {state === "gradient" ? (
        <div className="plan-backdrop-layer plan-backdrop-gradient" style={gradientVars(lat, lon)} />
      ) : (
        <div className="plan-backdrop-layer">
          <canvas ref={canvasRef} className="plan-backdrop-photo" />
        </div>
      )}
    </div>
  );
}
