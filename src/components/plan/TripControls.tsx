"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useTransition } from "react";
import { OriginCombobox } from "@/components/search/OriginCombobox";
import { PassengerStepper } from "@/components/search/PassengerStepper";
import { readRememberedOrigin, rememberOrigin, type OriginOption } from "@/data/origins";
import { BUDGET_FLIGHT_DROPPED_EVENT } from "@/lib/budget/params";
import { cn } from "@/lib/cn";
import { writeTripParams } from "@/lib/search/params";

const FLIGHT_KEYS = ["flight", "wf", "wfs"];

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
      const before = new URLSearchParams(window.location.search);
      const params = writeTripParams(before, toChange(next));
      if (FLIGHT_KEYS.some((k) => before.has(k)) && !FLIGHT_KEYS.some((k) => params.has(k))) {
        window.dispatchEvent(new Event(BUDGET_FLIGHT_DROPPED_EVENT));
      }
      router.replace(`/plan?${params.toString()}${window.location.hash}`, { scroll: false });
    });
  return { shown, pending, change };
}

const label = "font-mono text-micro uppercase tracking-[0.08em] text-ink-muted";

/**
 * "Kalkış": any city with an airport, in the flights section. The choice is remembered in this browser: a plan
 * whose link names no origin opens with the remembered one (İstanbul when there is none or storage is blocked).
 */
export function OriginControl({ value, className }: { value: OriginOption; className?: string }) {
  const { shown, pending, change } = useTripParam(value, (origin) => ({ from: origin.code }));
  const choose = (origin: OriginOption) => {
    rememberOrigin(origin);
    change(origin);
  };
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("from")) return;
    const remembered = readRememberedOrigin();
    if (remembered && remembered.code !== value.code) change(remembered);
    // Once per page: later changes come from the person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <OriginCombobox value={shown} onChange={choose} aria-busy={pending} className={cn("w-full sm:w-80", className)} />;
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
