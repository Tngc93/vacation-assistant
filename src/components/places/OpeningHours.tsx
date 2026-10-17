"use client";

import { useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { describeWeek, openStatus, parseOpeningHours } from "@/lib/places/hours";
import { subscribeMinute } from "@/lib/time/clock";

/**
 * "Şu an açık · 18:00'de kapanır" in the city's time zone, plus the full week
 * behind "Tüm saatler". Values outside the supported format render nothing.
 * The status is computed in the browser only, so it is never stale or
 * mismatched after hydration.
 */
export function OpeningHours({ value, timeZone }: { value: string; timeZone: string }) {
  const week = useMemo(() => parseOpeningHours(value), [value]);
  const status = useSyncExternalStore(
    subscribeMinute,
    () => (week ? JSON.stringify(openStatus(week, new Date(), timeZone)) : "null"),
    () => "null",
  );
  if (!week) return null;
  const now = JSON.parse(status) as ReturnType<typeof openStatus>;

  return (
    <div className="mt-2">
      {now ? (
        <p
          className={cn(
            "font-mono text-micro uppercase tracking-[0.08em]",
            now.open ? "text-ok" : "text-ink-muted",
          )}
        >
          {now.text}
        </p>
      ) : null}
      <details className="mt-1 text-caption text-ink-muted">
        <summary className="cursor-pointer select-none underline underline-offset-4">Tüm saatler</summary>
        <ul className="mt-1.5 grid gap-0.5 font-mono text-micro tabular">
          {describeWeek(week).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
