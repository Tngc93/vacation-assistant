"use client";

import { useSyncExternalStore } from "react";
import { formatLocalTime } from "@/lib/city/geo";

function subscribeMinute(callback: () => void) {
  // Tick at the start of each minute, then every minute.
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

/** The city's local time, rendered on the client only and updated every minute. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const time = useSyncExternalStore(
    subscribeMinute,
    () => formatLocalTime(new Date(), timeZone),
    () => null,
  );
  return (
    <time suppressHydrationWarning aria-label={time ? `Yerel saat ${time}` : "Yerel saat"}>
      {time ? `Yerel saat ${time}` : "Yerel saat --:--"}
    </time>
  );
}
