"use client";

import { useI18n } from "@/i18n/client";
import { ArrowUpRight } from "lucide-react";
import { withGoogleLanguage } from "@/lib/flights/links";

/** The search result's links: the type is redeclared here, the search module is server-only. */
type Links = { aviasales: string; googleFlights: string };

/** Live prices elsewhere; both links work without a token. */
export function FlightsLinks({ links, className }: { links: Links; className?: string }) {
  const { locale, m } = useI18n();
  return (
    <p className={className}>
      <span className="flex flex-wrap gap-x-6 gap-y-2 text-body">
        <a href={links.aviasales} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          {m.flights.aviasales}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
        <a href={withGoogleLanguage(links.googleFlights, locale)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          {m.flights.openGoogleFlights}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </span>
    </p>
  );
}
