"use client";

import { useEffect, useRef } from "react";

/**
 * The home page's route map behind the hero (DESIGN.md "Home background"). Decoration only: hidden from assistive
 * technology, never focusable, never in the way of a click. The canvas stays empty until the page has loaded and the
 * browser is idle; then the map's code (src/lib/home/routeMap.ts, with the dot grid) is fetched and started, so the
 * first paint and the largest one never wait for it. Without it (offline, an old browser) the page is plain paper.
 */
export function HomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      import("@/lib/home/routeMap")
        .then(({ startRouteMap }) => {
          if (!cancelled && canvasRef.current) stop = startRouteMap(canvasRef.current).stop;
        })
        .catch(() => {
          // No map (the chunk could not load): the page is plain paper, as before.
        });
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") idleHandle = window.requestIdleCallback(start, { timeout: 2500 });
      else timeoutHandle = setTimeout(start, 300);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      stop?.();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden print:hidden">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-home-background=""
        className="block h-full w-full opacity-0 transition-opacity duration-700 ease-out data-[ready]:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}
