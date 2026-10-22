"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { OriginPicker } from "@/components/search/OriginPicker";
import { PassengerStepper } from "@/components/search/PassengerStepper";
import type { OriginCode } from "@/data/origins";
import { cn } from "@/lib/cn";
import { writeTripParams } from "@/lib/search/params";

/**
 * Writes `?from=` or `?pax=` in place (every other param kept, no jump to the top); the server then renders the
 * flights, the stay links and the budget for the new value. The control shows the new value at once.
 */
function useTripParam<T>(value: T, toChange: (next: T) => Parameters<typeof writeTripParams>[1]) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(value);
  const change = (next: T) =>
    startTransition(() => {
      setShown(next);
      const params = writeTripParams(new URLSearchParams(window.location.search), toChange(next));
      router.replace(`/plan?${params.toString()}${window.location.hash}`, { scroll: false });
    });
  return { shown, pending, change };
}

const label = "font-mono text-micro uppercase tracking-[0.08em] text-ink-muted";

/** "Kalkış": İstanbul (IST + SAW) or Ankara (ESB), in the flights section. */
export function OriginControl({ value, className }: { value: OriginCode; className?: string }) {
  const { shown, pending, change } = useTripParam(value, (from) => ({ from }));
  return <OriginPicker value={shown} onChange={change} aria-busy={pending} className={className} />;
}

/** "Kişi" (1–9), in the stay and the flight sections; both write the same `?pax=`. */
export function PeopleControl({ value, className }: { value: number; className?: string }) {
  const { shown, pending, change } = useTripParam(value, (pax) => ({ pax }));
  return (
    <div className={cn("min-w-0", className)} aria-busy={pending}>
      <span aria-hidden="true" className={label}>
        Kişi
      </span>
      <PassengerStepper value={shown} onChange={change} className="mt-1.5" />
    </div>
  );
}
