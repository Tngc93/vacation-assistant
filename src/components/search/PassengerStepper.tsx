"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
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

export function PassengerStepper({ value, onChange, className }: PassengerStepperProps) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cn("flex items-center gap-2", className)}>
      <span id={labelId} className="sr-only">
        Yolcu sayısı
      </span>
      <button
        type="button"
        aria-label="Yolcu azalt"
        disabled={value <= MIN_PASSENGERS}
        onClick={() => onChange(Math.max(MIN_PASSENGERS, value - 1))}
        className={stepButton}
      >
        <Minus aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
      <output aria-live="polite" className="min-w-14 text-center font-mono text-body tabular text-ink">
        {value} kişi
      </output>
      <button
        type="button"
        aria-label="Yolcu artır"
        disabled={value >= MAX_PASSENGERS}
        onClick={() => onChange(Math.min(MAX_PASSENGERS, value + 1))}
        className={stepButton}
      >
        <Plus aria-hidden="true" size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
