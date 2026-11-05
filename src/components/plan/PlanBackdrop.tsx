"use client";

import { useEffect, useRef, useState } from "react";
import { gradientVars, PLAN_BACKGROUND } from "@/lib/plan-background/config";

/** `pending` until the masthead photo has loaded; `gradient` without one, or when it fails. */
export type BackdropState = "pending" | "photo" | "gradient";

/** The masthead photo's `<img>` (CityPhoto); the backdrop copies it instead of asking the network again. */
export const CITY_PHOTO_SELECTOR = "img[data-city-photo]";

/**
 * Draws a loaded image into the canvas, small (`canvasWidth` px wide, the photo's own proportions): scaled up behind
 * the hero, the downscale is most of the blur. False when the browser cannot draw it.
 */
export function drawSmall(canvas: HTMLCanvasElement, img: HTMLImageElement): boolean {
  const width = PLAN_BACKGROUND.atmosphere.canvasWidth;
  if (!img.naturalWidth || !img.naturalHeight) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return true;
  } catch {
    return false;
  }
}

/**
 * The plan hero's atmosphere (DESIGN.md "Plan background"): the masthead's city photo, blurred, in duotone and at a
 * low opacity, full width behind the hero and fading into the paper; a plain gradient from tokens, set by the
 * city's coordinates, when there is no photo or it fails. Decoration only: hidden from assistive technology, never
 * focusable, never in the way of a click, not printed. A canvas, not a second `<img>`: no new request, and it is
 * never the page's largest paint. Its slow drift (Ken Burns) is CSS and stops with reduced motion.
 */
export function PlanBackdrop({ hasPhoto, lat, lon }: { hasPhoto: boolean; lat: number; lon: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<BackdropState>(hasPhoto ? "pending" : "gradient");

  useEffect(() => {
    if (!hasPhoto) return;
    const img = rootRef.current?.parentElement?.querySelector<HTMLImageElement>(CITY_PHOTO_SELECTOR);
    const canvas = canvasRef.current;
    const show = () => setState(img && canvas && drawSmall(canvas, img) ? "photo" : "gradient");
    if (!img || !canvas) return show();
    if (img.complete) return show();
    const fail = () => setState("gradient");
    img.addEventListener("load", show, { once: true });
    img.addEventListener("error", fail, { once: true });
    return () => {
      img.removeEventListener("load", show);
      img.removeEventListener("error", fail);
    };
  }, [hasPhoto]);

  return (
    <div ref={rootRef} aria-hidden="true" data-plan-backdrop="" data-state={state} className="plan-backdrop">
      {state === "gradient" ? (
        <div className="plan-backdrop-layer plan-backdrop-gradient" style={gradientVars(lat, lon)} />
      ) : (
        <div className="plan-backdrop-layer duotone">
          <canvas ref={canvasRef} className="plan-backdrop-photo" />
        </div>
      )}
    </div>
  );
}
