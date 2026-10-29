"use client";

import { useI18n } from "@/i18n/client";
import { formatLocalTime } from "@/lib/city/geo";
import { useMinuteNow } from "@/lib/time/clock";

/** The city's local time, rendered on the client only and updated every minute. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const { m } = useI18n();
  const now = useMinuteNow();
  const time = now ? formatLocalTime(now, timeZone) : null;
  return (
    <time suppressHydrationWarning aria-label={time ? `${m.city.localTime} ${time}` : m.city.localTime}>
      {`${m.city.localTime} ${time ?? "--:--"}`}
    </time>
  );
}
