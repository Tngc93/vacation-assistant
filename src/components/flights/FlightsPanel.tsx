"use client";

import { useState, type ReactNode } from "react";
import { DisclosureToggle } from "@/components/plan/DisclosureToggle";

type Props = {
  /** "Kalkış" and "Kişi". */
  controls: ReactNode;
  /** Each airport's cheapest ticket (and the printed flight summary). */
  cheapest: ReactNode;
  /** The full list, its filter and the flight web search. */
  all: ReactNode;
};

/**
 * "Uçuşlar": the origin and the number of people on top, each airport's cheapest ticket below; "Tüm uçuşları gör"
 * (closed by default) opens the full list at the section's full width. Closed, the list stays mounted (hidden),
 * so an opened return list or a web search survives closing and reopening.
 */
export function FlightsPanel({ controls, cheapest, all }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 print:hidden">{controls}</div>
      <div className="mt-6 print:mt-0">{cheapest}</div>
      <DisclosureToggle open={open} controls="tum-ucuslar" onClick={() => setOpen((o) => !o)}>
        Tüm uçuşları gör
      </DisclosureToggle>
      <div id="tum-ucuslar" hidden={!open} className="mt-8 print:hidden">
        {all}
      </div>
    </div>
  );
}
