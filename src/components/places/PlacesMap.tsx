"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { StoredPlace } from "@/lib/places/file";
import {
  applyPatches,
  MAP_ATTRIBUTION,
  OPENFREEMAP_STYLE_URL,
  PALETTE_TOKENS,
  stylePatches,
  type MapPalette,
} from "@/lib/places/mapStyle";

export type PlacesMapProps = {
  places: readonly StoredPlace[];
  center: { lat: number; lon: number };
  activeId: string | null;
  selectedId: string | null;
  onActivate: (id: string | null) => void;
  onSelect: (id: string) => void;
};

const DOTS = "places-dots";
const SELECTED_LABEL = "selected-label";

function readPalette(): MapPalette {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, css.getPropertyValue(token).trim()]),
  ) as MapPalette;
}

function toFeatures(places: readonly StoredPlace[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      properties: { id: p.id, name: p.name },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    })),
  };
}

let stylePromise: Promise<StyleSpecification> | null = null;
function loadBaseStyle() {
  stylePromise ??= fetch(OPENFREEMAP_STYLE_URL).then((r) => {
    if (!r.ok) throw new Error(`Map style ${r.status}`);
    return r.json() as Promise<StyleSpecification>;
  });
  return stylePromise;
}

/** MapLibre + OpenFreeMap, recoloured from the design tokens and kept in step with the list. */
export default function PlacesMap({ places, center, activeId, selectedId, onActivate, onSelect }: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const baseLayersRef = useRef<StyleSpecification["layers"]>([]);
  const activeRef = useRef<string | null>(null);
  const callbacks = useRef({ onActivate, onSelect });
  const placesRef = useRef(places);
  // Map event handlers read the latest props through refs, updated after each render.
  useEffect(() => {
    callbacks.current = { onActivate, onSelect };
    placesRef.current = places;
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    loadBaseStyle()
      .then((base) => {
        if (cancelled || !containerRef.current) return;
        const palette = readPalette();
        baseLayersRef.current = base.layers;
        const style = applyPatches(base as StyleSpecification & { layers: never[] }, stylePatches(base.layers, palette));

        const map = new MapLibreMap({
          container: containerRef.current,
          style,
          center: [center.lon, center.lat],
          zoom: 13,
          attributionControl: false,
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(new AttributionControl({ compact: false, customAttribution: MAP_ATTRIBUTION }), "bottom-right");
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          map.addSource("places", { type: "geojson", data: toFeatures(placesRef.current), promoteId: "id" });
          map.addSource("selected", { type: "geojson", data: toFeatures([]) });
          map.addLayer({
            id: DOTS,
            type: "circle",
            source: "places",
            paint: {
              "circle-color": ["case", ["boolean", ["feature-state", "active"], false], palette.accent, palette.ink],
              "circle-radius": ["case", ["boolean", ["feature-state", "active"], false], 7, 4.5],
              "circle-stroke-color": palette.paper,
              "circle-stroke-width": 1.5,
            },
          });
          map.addLayer({
            id: SELECTED_LABEL,
            type: "symbol",
            source: "selected",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 13,
              "text-offset": [0, 1.1],
              "text-anchor": "top",
              "text-max-width": 12,
            },
            paint: { "text-color": palette.ink, "text-halo-color": palette.paper, "text-halo-width": 1.5 },
          });
          map.addLayer({
            id: `${SELECTED_LABEL}-dot`,
            type: "circle",
            source: "selected",
            paint: {
              "circle-color": palette.accent,
              "circle-radius": 7,
              "circle-stroke-color": palette.paper,
              "circle-stroke-width": 2,
            },
          });

          map.on("click", DOTS, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") callbacks.current.onSelect(id);
          });
          map.on("mouseenter", DOTS, (event) => {
            map.getCanvas().style.cursor = "pointer";
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") callbacks.current.onActivate(id);
          });
          map.on("mouseleave", DOTS, () => {
            map.getCanvas().style.cursor = "";
            callbacks.current.onActivate(null);
          });
          readyRef.current = true;
          fitToPlaces(map, placesRef.current);
        });
      })
      .catch(() => {
        // The list works without the map; the container shows its fallback text.
        if (containerRef.current) containerRef.current.dataset.failed = "true";
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once per city; later changes are applied below.
  }, [center.lat, center.lon]);

  // Recolour when the theme changes (manual switch or system setting).
  useEffect(() => {
    const repaint = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const palette = readPalette();
      for (const patch of stylePatches(baseLayersRef.current, palette)) {
        if (map.getLayer(patch.layer)) {
          map.setPaintProperty(patch.layer, patch.property as Parameters<MapLibreMap["setPaintProperty"]>[1], patch.value);
        }
      }
      map.setPaintProperty(DOTS, "circle-color", [
        "case",
        ["boolean", ["feature-state", "active"], false],
        palette.accent,
        palette.ink,
      ]);
      map.setPaintProperty(DOTS, "circle-stroke-color", palette.paper);
      map.setPaintProperty(SELECTED_LABEL, "text-color", palette.ink);
      map.setPaintProperty(SELECTED_LABEL, "text-halo-color", palette.paper);
      map.setPaintProperty(`${SELECTED_LABEL}-dot`, "circle-color", palette.accent);
      map.setPaintProperty(`${SELECTED_LABEL}-dot`, "circle-stroke-color", palette.paper);
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

  // New data (categories changed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("places") as GeoJSONSource | undefined)?.setData(toFeatures(places));
    fitToPlaces(map, places);
  }, [places]);

  // Highlight the hovered or focused card's dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (activeRef.current) map.setFeatureState({ source: "places", id: activeRef.current }, { active: false });
    if (activeId) map.setFeatureState({ source: "places", id: activeId }, { active: true });
    activeRef.current = activeId;
  }, [activeId]);

  // Selected place: accent dot with a label, and bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const place = places.find((p) => p.id === selectedId);
    (map.getSource("selected") as GeoJSONSource | undefined)?.setData(toFeatures(place ? [place] : []));
    if (place) map.easeTo({ center: [place.lon, place.lat], zoom: Math.max(map.getZoom(), 15), duration: 250 });
  }, [selectedId, places]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Mekân haritası"
      className="group relative h-80 w-full overflow-hidden rounded-md border border-rule bg-paper-raised md:h-[32rem]"
    >
      <p className="absolute inset-0 hidden items-center justify-center p-6 text-center text-caption text-ink-muted group-data-[failed=true]:flex">
        Harita şu an yüklenemedi; liste kullanılabilir.
      </p>
    </div>
  );
}

function fitToPlaces(map: MapLibreMap, places: readonly StoredPlace[]) {
  if (places.length === 0) return;
  const bounds = new LngLatBounds();
  for (const p of places) bounds.extend([p.lon, p.lat]);
  map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
}
