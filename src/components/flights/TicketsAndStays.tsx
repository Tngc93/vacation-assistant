"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAiConnection } from "@/components/ai/useAiConnection";
import { cn } from "@/lib/cn";

type Props = {
  /** Each airport's cheapest ticket (and the printed flight summary). */
  flights: ReactNode;
  /** The full list, its filter and the flight web search. */
  allFlights: ReactNode;
  /** The stay links. */
  stay: ReactNode;
  /** The stay web search (renders nothing without AI). */
  stayWeb: ReactNode;
  /** VA_AI_MOCK: the stay web search is there without a key. */
  demo: boolean;
};

function Toggle({ open, controls, onClick, children }: { open: boolean; controls: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-1.5 border-t border-rule pt-4 text-caption font-medium text-ink print:hidden"
    >
      <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} className={cn("transition-transform duration-200", open && "rotate-180")} />
      {children}
    </button>
  );
}

/**
 * Two quiet cards side by side (stacked on phones); what they open (the full flight list, the web searches)
 * appears under both, at the section's full width. Closed panels stay mounted (hidden), so a search or an
 * opened return list survives closing and reopening.
 */
export function TicketsAndStays({ flights, allFlights, stay, stayWeb, demo }: Props) {
  const [flightsOpen, setFlightsOpen] = useState(false);
  const [stayOpen, setStayOpen] = useState(false);
  const connected = useAiConnection() !== null || demo;
  const card = "min-w-0 scroll-mt-20 rounded-md border border-rule bg-paper-raised px-5 py-6 md:px-6";
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div id="ucuslar" className={cn(card, "print:border-0 print:p-0")}>
          <h3 className="mb-4 font-display text-heading print:hidden">Uçuş</h3>
          {flights}
          <Toggle open={flightsOpen} controls="tum-ucuslar" onClick={() => setFlightsOpen((o) => !o)}>
            Tüm uçuşları gör
          </Toggle>
        </div>
        <div id="konaklama" className={cn(card, "print:hidden")}>
          <h3 className="mb-4 font-display text-heading">Konaklama</h3>
          {stay}
          {connected ? (
            <Toggle open={stayOpen} controls="konaklama-web" onClick={() => setStayOpen((o) => !o)}>
              Web&apos;de ara
            </Toggle>
          ) : null}
        </div>
      </div>
      <div id="tum-ucuslar" hidden={!flightsOpen} className="mt-8 print:hidden">
        {allFlights}
      </div>
      <div id="konaklama-web" hidden={!stayOpen || !connected} className="mt-8 print:hidden">
        <h3 className="mb-4 font-display text-heading">Konaklama · web&apos;de ara</h3>
        {stayWeb}
      </div>
    </div>
  );
}
