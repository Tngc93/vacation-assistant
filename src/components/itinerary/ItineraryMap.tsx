"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { PlanStop } from "@/lib/itinerary/plan";
import { applyPatches, MAP_ATTRIBUTION, OPENFREEMAP_STYLE_URL, PALETTE_TOKENS, stylePatches, type MapPalette } from "@/lib/places/mapStyle";

function readPalette(): MapPalette {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, css.getPropertyValue(token).trim()])) as MapPalette;
}

function toFeatures(stops: readonly PlanStop[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((s, i) => ({
      type: "Feature",
      properties: { n: String(i + 1), name: s.name },
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    })),
  };
}

function fit(map: MapLibreMap, stops: readonly PlanStop[]) {
  if (!stops.length) return;
  const bounds = new LngLatBounds();
  for (const s of stops) bounds.extend([s.lon, s.lat]);
  map.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: 0 });
}

/** One day's stops, numbered in order, on the recoloured OpenFreeMap style. */
export default function ItineraryMap({ stops, center }: { stops: readonly PlanStop[]; center: { lat: number; lon: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  });

  useEffect(() => {
    let cancelled = false;
    setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    fetch(OPENFREEMAP_STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Map style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then((base) => {
        if (cancelled || !containerRef.current) return;
        const palette = readPalette();
        const map = new MapLibreMap({
          container: containerRef.current,
          style: applyPatches(base as StyleSpecification & { layers: never[] }, stylePatches(base.layers, palette)),
          center: [center.lon, center.lat],
          zoom: 13,
          attributionControl: false,
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          map.addSource("stops", { type: "geojson", data: toFeatures(stopsRef.current) });
          map.addLayer({
            id: "stops-dot",
            type: "circle",
            source: "stops",
            paint: { "circle-color": palette.ink, "circle-radius": 10, "circle-stroke-color": palette.paper, "circle-stroke-width": 2 },
          });
          map.addLayer({
            id: "stops-number",
            type: "symbol",
            source: "stops",
            layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true },
            paint: { "text-color": palette.paper },
          });
          readyRef.current = true;
          fit(map, stopsRef.current);
        });
      })
      .catch(() => {
        if (containerRef.current) containerRef.current.dataset.failed = "true";
      });
    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lon]);

  // Recolour when the theme changes (manual switch or system setting).
  useEffect(() => {
    const repaint = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const palette = readPalette();
      for (const patch of stylePatches(map.getStyle().layers, palette)) {
        if (map.getLayer(patch.layer)) map.setPaintProperty(patch.layer, patch.property as Parameters<MapLibreMap["setPaintProperty"]>[1], patch.value);
      }
      map.setPaintProperty("stops-dot", "circle-color", palette.ink);
      map.setPaintProperty("stops-dot", "circle-stroke-color", palette.paper);
      map.setPaintProperty("stops-number", "text-color", palette.paper);
    };
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", repaint);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", repaint);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("stops") as GeoJSONSource | undefined)?.setData(toFeatures(stops));
    fit(map, stops);
  }, [stops]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Günün haritası"
      className="group relative h-80 w-full overflow-hidden rounded-md border border-rule bg-paper-raised md:h-[28rem]"
    >
      <p className="absolute inset-0 hidden items-center justify-center p-6 text-center text-caption text-ink-muted group-data-[failed=true]:flex">
        Harita şu an yüklenemedi; plan kullanılabilir.
      </p>
      <p className="absolute bottom-0 right-0 z-10 max-w-full rounded-tl-sm bg-paper-raised/90 px-2 py-0.5 text-[0.6875rem] text-ink-muted">
        {MAP_ATTRIBUTION.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? " · " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              {source.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
