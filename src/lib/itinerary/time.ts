import { ITINERARY } from "./config";

/** "09:05" → 545 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 545 → "09:05" (minutes past midnight, any day). */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Rounds up to the plan's time step (5 minutes). */
export const roundUp = (minutes: number) => Math.ceil(minutes / ITINERARY.roundMin) * ITINERARY.roundMin;
export const roundDown = (minutes: number) => Math.floor(minutes / ITINERARY.roundMin) * ITINERARY.roundMin;

/** Weekday of a calendar date, 0 = Monday … 6 = Sunday (the date itself has no time zone). */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
