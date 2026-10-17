import { useSyncExternalStore } from "react";

/** useSyncExternalStore subscriber that ticks at the start of every minute. */
export function subscribeMinute(callback: () => void) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    callback();
    interval = setInterval(callback, 60_000);
  }, 60_000 - (Date.now() % 60_000));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}

/** Start of the current minute; stable within the minute, so React re-renders once a minute. */
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;

/**
 * The current time (to the minute) for client components, or null on the
 * server and during hydration, so server and browser never disagree.
 * Components pass it on as `now`; tests control it with vi.setSystemTime.
 */
export function useMinuteNow(): Date | null {
  const ms = useSyncExternalStore(subscribeMinute, currentMinute, () => null);
  return ms === null ? null : new Date(ms);
}
