/**
 * The day map beside the day-by-day plan (desktop): which day it shows while the page scrolls, and how its
 * numbered markers match the list. Pure; the component measures the headings and owns the timer's clock.
 */
import type { PlanDay, PlanStop } from "./plan";

/** A day's heading counts as reached once its top has crossed this share of the viewport, from the top. */
export const ACTIVE_DAY_LINE = 0.4;
/** Scroll-following waits this long after the last change, so a fast scroll does not flick the map through days. */
export const ACTIVE_DAY_DEBOUNCE_MS = 150;
/** The map's fit to a day's stops; none with reduced motion. */
export const DAY_MAP_FIT_MS = 400;

export type DayHeading = { day: number; top: number };

/**
 * The active day: the last heading (in page order) whose top is at or above the line; before the first one has
 * crossed it, the first day. Null without headings.
 */
export function activeDayAt(headings: readonly DayHeading[], viewportHeight: number, line = ACTIVE_DAY_LINE): number | null {
  if (!headings.length) return null;
  const limit = viewportHeight * line;
  let active = headings[0].day;
  for (const heading of headings) if (heading.top <= limit) active = heading.day;
  return active;
}

export type ActiveDayTracker = {
  /** The day measured now; reported after the delay, and only when it differs from the last one reported. */
  update(day: number | null): void;
  /** Drops a change still waiting (a day was just forced onto the map); the last reported day stays. */
  cancel(): void;
};

/**
 * Debounces the measured day and reports changes only. A day forced onto the map in between ("Haritada göster")
 * stays until the measured day really changes; scroll-following then goes on.
 */
export function createActiveDayTracker({ delayMs = ACTIVE_DAY_DEBOUNCE_MS, onChange }: { delayMs?: number; onChange: (day: number) => void }): ActiveDayTracker {
  let last: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    update(day) {
      cancel();
      if (day === null || day === last) return;
      timer = setTimeout(() => {
        timer = null;
        last = day;
        onChange(day);
      }, delayMs);
    },
    cancel,
  };
}

/**
 * The numbered stops of a day, as the list and the map both number them: 1, 2, 3… in the day's order. A place
 * inside a stop (`PlanStop.inside`) has no number and no marker of its own: it shares its stop's.
 */
export function numberedStops(day: Pick<PlanDay, "stops">): { number: number; stop: PlanStop }[] {
  return day.stops.map((stop, i) => ({ number: i + 1, stop }));
}

/** The list item of a numbered stop, which a click on its marker scrolls to. */
export const stopAnchorId = (day: number, number: number) => `gun-${day}-durak-${number}`;
