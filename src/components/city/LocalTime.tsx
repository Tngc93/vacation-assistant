"use client";

import { useSyncExternalStore } from "react";
import { formatLocalTime } from "@/lib/city/geo";
import { subscribeMinute } from "@/lib/time/clock";

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
