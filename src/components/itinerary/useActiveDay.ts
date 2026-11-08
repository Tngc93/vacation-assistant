"use client";

import { useCallback, useEffect, useRef } from "react";
import { ACTIVE_DAY_DEBOUNCE_MS, ACTIVE_DAY_LINE, activeDayAt, createActiveDayTracker, type ActiveDayTracker } from "@/lib/itinerary/dayMap";

/**
 * Follows the page's scroll with the day map: `onChange` gets the day whose heading (`#gun-<n>`) has crossed the
 * top 40% of the viewport, debounced, and only when that day changes. An IntersectionObserver whose root is that
 * band says when a heading crosses it (and `scrollend` after a jump); every heading is then measured and
 * `activeDayAt` decides. Returns `hold`,
 * which drops a change still waiting (a day was just forced onto the map).
 */
export function useActiveDay(days: readonly number[], enabled: boolean, onChange: (day: number) => void): () => void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const trackerRef = useRef<ActiveDayTracker | null>(null);
  const key = days.join(",");

  useEffect(() => {
    if (!enabled || !key || typeof IntersectionObserver === "undefined") return;
    const headings = key
      .split(",")
      .map((n) => ({ day: Number(n), el: document.getElementById(`gun-${n}`) }))
      .filter((h): h is { day: number; el: HTMLElement } => h.el !== null);
    if (!headings.length) return;
    const tracker = createActiveDayTracker({ delayMs: ACTIVE_DAY_DEBOUNCE_MS, onChange: (day) => onChangeRef.current(day) });
    trackerRef.current = tracker;
    const measure = () =>
      tracker.update(activeDayAt(headings.map(({ day, el }) => ({ day, top: el.getBoundingClientRect().top })), window.innerHeight));
    const observer = new IntersectionObserver(measure, { rootMargin: `0px 0px -${Math.round((1 - ACTIVE_DAY_LINE) * 100)}% 0px` });
    for (const { el } of headings) observer.observe(el);
    // A jump (End, a link, a fast fling) can carry a heading past the whole band within one frame, which the
    // observer never sees: measure once more when the scroll settles, where the browser has `scrollend`.
    window.addEventListener("scrollend", measure, { passive: true });
    return () => {
      window.removeEventListener("scrollend", measure);
      observer.disconnect();
      tracker.cancel();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
  }, [enabled, key]);

  return useCallback(() => trackerRef.current?.cancel(), []);
}
