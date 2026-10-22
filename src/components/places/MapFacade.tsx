"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { StoredPlace } from "@/lib/places/file";

const EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"] as const;

/**
 * True after the person's first sign of use (a pointer, a key, a scroll). MapLibre (≈270 KB of script and a
 * WebGL start-up) waits for it, so the page's first paint and the city photo do not compete with the map.
 */
export function useFirstInteraction(): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const on = () => setSeen(true);
    for (const e of EVENTS) window.addEventListener(e, on, { once: true, passive: true });
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, on);
    };
  }, [seen]);
  return seen;
}

/**
 * A light stand-in for the map until MapLibre loads: the same places as dots on paper, the lit and the picked
 * one in accent, framed like the map. No tiles, no script beyond this component.
 */
export function MapFacade({
  places,
  activeId,
  selectedId,
  className,
}: {
  places: readonly StoredPlace[];
  activeId: string | null;
  selectedId: string | null;
  className?: string;
}) {
  const lats = places.map((p) => p.lat);
  const lons = places.map((p) => p.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  // Longitude shrinks with latitude: keep the dots' shape close to the real one.
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const w = Math.max((maxLon - minLon) * kx, 1e-4);
  const h = Math.max(maxLat - minLat, 1e-4);
  const x = (lon: number) => 5 + ((lon - minLon) * kx * 90) / w;
  const y = (lat: number) => 5 + ((maxLat - lat) * 90) / h;
  const lit = (id: string) => id === activeId || id === selectedId;
  return (
    <div
      role="region"
      aria-label="Mekân haritası"
      data-places={places.length}
      data-active={activeId ?? ""}
      data-selected={selectedId ?? ""}
      className={cn("relative w-full overflow-hidden rounded-md border border-rule bg-paper-raised", className)}
    >
      {places.length ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="absolute inset-0 h-full w-full">
          {places.map((p) => (
            <circle
              key={p.id}
              cx={x(p.lon)}
              cy={y(p.lat)}
              r={lit(p.id) ? 1.6 : 0.9}
              className={lit(p.id) ? "fill-accent" : "fill-ink"}
              stroke="var(--paper)"
              strokeWidth={0.3}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
