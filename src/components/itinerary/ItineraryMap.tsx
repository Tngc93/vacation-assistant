"use client";

import { MapAttribution } from "@/components/places/MapAttribution";
import { useI18n } from "@/i18n/client";
import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { DAY_MAP_FIT_MS, numberedStops } from "@/lib/itinerary/dayMap";
import type { PlanStop } from "@/lib/itinerary/plan";
import { applyPatches, OPENFREEMAP_STYLE_URL, PALETTE_TOKENS, stylePatches, type MapPalette } from "@/lib/places/mapStyle";

function readPalette(): MapPalette {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, css.getPropertyValue(token).trim()])) as MapPalette;
}

/** The day's walk in its order, as one line from stop to stop (no routing: the list has the walking times). */
function toRoute(stops: readonly PlanStop[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features:
      stops.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops.map((s) => [s.lon, s.lat]) } }]
        : [],
  };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fits the day's stops; the top keeps room for the day caption. `animate` eases over DAY_MAP_FIT_MS, never with reduced motion. */
function fit(map: MapLibreMap, stops: readonly PlanStop[], animate: boolean): number {
  if (!stops.length) return 0;
  const bounds = new LngLatBounds();
  for (const s of stops) bounds.extend([s.lon, s.lat]);
  const duration = animate && !reducedMotion() ? DAY_MAP_FIT_MS : 0;
  map.fitBounds(bounds, { padding: { top: 64, right: 48, bottom: 40, left: 40 }, maxZoom: 15.5, duration });
  return duration;
}

/**
 * Marker classes: the list's numbered dot (DESIGN.md "Itinerary"), larger and accent while its stop is hovered or
 * focused. It grows by its size, not `scale`: MapLibre places a marker with `transform`, which `scale` would multiply.
 */
const MARKER =
  "flex size-6 cursor-pointer items-center justify-center rounded-full border-2 border-paper font-mono text-fine leading-none tabular " +
  "transition-[width,height] duration-150 motion-reduce:transition-none data-[highlighted=true]:z-10 data-[highlighted=true]:size-8 " +
  "data-[highlighted=true]:border-accent-ink data-[highlighted=true]:bg-accent data-[highlighted=true]:text-accent-ink";
const MARKER_KIND = { daytime: "bg-ink text-paper-raised", evening: "bg-paper-raised text-ink ring-1 ring-ink" } as const;

type Props = {
  stops: readonly PlanStop[];
  center: { lat: number; lon: number };
  /** The day on the map; written to `data-day` once its stops are drawn. */
  day: number;
  /** The number of the stop hovered or focused in the list. */
  highlighted?: number | null;
  /** A marker was clicked: the list scrolls to that stop. */
  onMarkerClick?: (number: number) => void;
};

/**
 * One day's stops on the recoloured OpenFreeMap style: numbered markers as the list numbers them (`numberedStops`;
 * a place inside a stop shares its marker), and the day's order as a dashed line. Markers are buttons: a click
 * brings the stop into view in the list.
 */
export default function ItineraryMap({ stops, center, day, highlighted = null, onMarkerClick }: Props) {
  const { m, f } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Marker[]>([]);
  const latest = useRef({ stops, day, highlighted, onMarkerClick, label: (n: number, name: string) => f(m.itinerary.mapMarker, { number: n, name }) });
  useEffect(() => {
    latest.current = { stops, day, highlighted, onMarkerClick, label: (n: number, name: string) => f(m.itinerary.mapMarker, { number: n, name }) };
  });

  /** Draws the current day: line, markers, highlight and fit. */
  const drawRef = useRef((animate: boolean) => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !readyRef.current || !container) return;
    const { stops: current, day: currentDay, highlighted: lit, label } = latest.current;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(toRoute(current));
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = numberedStops({ stops: [...current] }).map(({ number, stop }) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `${MARKER} ${MARKER_KIND[stop.kind]}`;
      el.textContent = String(number);
      el.dataset.stopMarker = String(number);
      el.dataset.highlighted = String(number === lit);
      el.setAttribute("aria-label", label(number, stop.name));
      // MapLibre would start a drag or a map click from the marker otherwise.
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        latest.current.onMarkerClick?.(number);
      });
      return new Marker({ element: el, anchor: "center" }).setLngLat([stop.lon, stop.lat]).addTo(map);
    });
    container.dataset.fitDuration = String(fit(map, current, animate));
    container.dataset.day = String(currentDay);
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
          map.addSource("route", { type: "geojson", data: toRoute(latest.current.stops) });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": palette.inkMuted, "line-width": 1.5, "line-dasharray": [2, 2] },
          });
          readyRef.current = true;
          drawRef.current(false);
        });
      })
      .catch(() => {
        if (containerRef.current) containerRef.current.dataset.failed = "true";
      });
    return () => {
      cancelled = true;
      readyRef.current = false;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
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
      map.setPaintProperty("route-line", "line-color", palette.inkMuted);
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

  // Another day (scroll-following or "Haritada göster"), or the day's stops changed: redraw and ease to them.
  useEffect(() => {
    drawRef.current(true);
  }, [stops, day]);

  // The stop hovered or focused in the list lights its marker.
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      marker.getElement().dataset.highlighted = String(i + 1 === highlighted);
    });
  }, [highlighted]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={m.itinerary.dayMap}
      data-object-card=""
      className="group relative h-80 w-full overflow-hidden rounded-md border border-rule bg-paper-raised md:h-[28rem]"
    >
      <p className="absolute inset-0 hidden items-center justify-center p-6 text-center text-caption text-ink-muted group-data-[failed=true]:flex">
        {m.places.mapFailedPlan}
      </p>
      <MapAttribution />
    </div>
  );
}
