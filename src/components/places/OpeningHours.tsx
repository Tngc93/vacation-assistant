"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { describeWeek, openStatus, parseOpeningHours } from "@/lib/places/hours";
import { useMinuteNow } from "@/lib/time/clock";

/**
 * "Şu an açık · 18:00'de kapanır" in the city's time zone, plus the full week
 * behind "Tüm saatler". Values outside the supported format render nothing.
 * The status is computed in the browser only, so it is never stale or
 * mismatched after hydration.
 */
export function OpeningHours({ value, timeZone }: { value: string; timeZone: string }) {
  const i18n = useI18n();
  const week = useMemo(() => parseOpeningHours(value), [value]);
  const now = useMinuteNow();
  if (!week) return null;
  const status = now ? openStatus(week, now, timeZone, i18n) : null;

  return (
    <div className="mt-2">
      {status ? (
        <p
          className={cn(
            "font-mono text-micro uppercase tracking-[0.08em]",
            status.open ? "text-ok" : "text-ink-muted",
          )}
        >
          {status.text}
        </p>
      ) : null}
      <details className="mt-1 text-caption text-ink-muted">
        <summary className="cursor-pointer select-none underline underline-offset-4">{i18n.m.hours.all}</summary>
        <ul className="mt-1.5 grid gap-0.5 font-mono text-micro tabular">
          {describeWeek(week, i18n).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
