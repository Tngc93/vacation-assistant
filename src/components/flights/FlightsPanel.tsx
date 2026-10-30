"use client";

import { useI18n } from "@/i18n/client";
import { useState, type ReactNode } from "react";
import { DisclosureToggle } from "@/components/plan/DisclosureToggle";
import { useOffline } from "@/components/pwa/useOffline";
import { Caption } from "@/components/ui";

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
 * so an opened return list or a web search survives closing and reopening. Offline (or a saved copy of the plan),
 * the prices are marked as not current.
 */
export function FlightsPanel({ controls, cheapest, all }: Props) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const offline = useOffline();
  return (
    <div>
      {offline ? (
        <Caption as="p" tone="warn" className="mb-6 rounded-sm border border-warn px-3 py-2">
          {m.pwa.flightsOffline}
        </Caption>
      ) : null}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 print:hidden">{controls}</div>
      <div className="mt-6 print:mt-0">{cheapest}</div>
      <DisclosureToggle open={open} controls="tum-ucuslar" onClick={() => setOpen((o) => !o)}>
        {m.flights.showAll}
      </DisclosureToggle>
      <div id="tum-ucuslar" hidden={!open} className="mt-8 print:hidden">
        {all}
      </div>
    </div>
  );
}
