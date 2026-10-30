"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { MAX_PASSENGERS, MIN_PASSENGERS } from "@/lib/search/params";

export type PassengerStepperProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
};

const stepButton =
  "inline-flex size-9 items-center justify-center rounded-sm border border-rule text-ink " +
  "transition-colors duration-150 ease-out hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rule";

/** The number of people (1–9): passengers on the flight and guests at the stay. */
export function PassengerStepper({ value, onChange, className }: PassengerStepperProps) {
  const { m, f } = useI18n();
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cn("flex items-center gap-2", className)}>
      <span id={labelId} className="sr-only">
        {m.search.people}
      </span>
      <button
        type="button"
        aria-label={m.search.fewer}
        disabled={value <= MIN_PASSENGERS}
        onClick={() => onChange(Math.max(MIN_PASSENGERS, value - 1))}
        className={stepButton}
      >
        <Minus aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
      <output aria-live="polite" className="min-w-14 text-center font-mono text-body tabular text-ink">
        {f(m.search.peopleCount, { count: value })}
      </output>
      <button
        type="button"
        aria-label={m.search.more}
        disabled={value >= MAX_PASSENGERS}
        onClick={() => onChange(Math.min(MAX_PASSENGERS, value + 1))}
        className={stepButton}
      >
        <Plus aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
