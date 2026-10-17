import { ArrowUpRight } from "lucide-react";
import type { FlightsLinks as Links } from "@/lib/flights/search";

/** Live prices elsewhere; both links work without a token. */
export function FlightsLinks({ links, className }: { links: Links; className?: string }) {
  return (
    <p className={className}>
      <span className="flex flex-wrap gap-x-6 gap-y-2 text-body">
        <a href={links.aviasales} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          Aviasales&apos;te güncel fiyatlar
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
        <a href={links.googleFlights} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          Google Flights&apos;ta aç
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </span>
    </p>
  );
}
