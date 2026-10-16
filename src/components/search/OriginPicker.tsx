"use client";

import { useId } from "react";
import { ORIGINS, type OriginCode } from "@/data/origins";
import { cn } from "@/lib/cn";

export type OriginPickerProps = {
  value: OriginCode;
  onChange: (code: OriginCode) => void;
  className?: string;
};

/** Segmented control built on native radios, so arrow keys move between options. */
export function OriginPicker({ value, onChange, className }: OriginPickerProps) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">Nereden</legend>
      <div className="inline-flex max-w-full rounded-sm border border-rule bg-paper p-0.5">
        {ORIGINS.map((origin) => {
          const id = `${name}-${origin.code}`;
          return (
            <div key={origin.code} className="min-w-0">
              <input
                id={id}
                type="radio"
                name={name}
                value={origin.code}
                checked={value === origin.code}
                onChange={() => onChange(origin.code)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-caption",
                  "transition-colors duration-150 ease-out",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-focus-visible:outline-solid",
                  "text-ink-muted hover:text-ink peer-checked:bg-ink peer-checked:text-paper-raised",
                )}
              >
                <span className="font-medium">{origin.nameTr}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular tracking-[0.04em]">{origin.airports.join(" + ")}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
