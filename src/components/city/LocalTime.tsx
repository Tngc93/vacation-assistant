"use client";

import { formatLocalTime } from "@/lib/city/geo";
import { useMinuteNow } from "@/lib/time/clock";

/** The city's local time, rendered on the client only and updated every minute. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const now = useMinuteNow();
  const time = now ? formatLocalTime(now, timeZone) : null;
  return (
    <time suppressHydrationWarning aria-label={time ? `Yerel saat ${time}` : "Yerel saat"}>
      {time ? `Yerel saat ${time}` : "Yerel saat --:--"}
    </time>
  );
}
