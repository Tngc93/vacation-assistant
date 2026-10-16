import { Suspense } from "react";
import { RateLine, RateLineFallback } from "@/components/plan/RateLine";
import { Caption } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { formatCoordinates } from "@/lib/city/geo";
import { CityPhoto, CityPhotoFallback } from "./CityPhoto";
import { LocalTime } from "./LocalTime";

/** City name in very large Fraunces, a mono data line, and a credited photo beside it. */
export function CityMasthead({ destination }: { destination: Destination }) {
  return (
    <header className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-end md:gap-12">
      <div className="min-w-0">
        <Caption as="p">Plan · {destination.countryTr}</Caption>
        <h1 className="mt-3 break-words font-display text-display">{destination.nameTr}</h1>
        <div className="mt-4 flex flex-col gap-1.5 font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{formatCoordinates(destination.lat, destination.lon)}</span>
            <span aria-hidden="true">·</span>
            <LocalTime timeZone={destination.timeZone} />
            <span aria-hidden="true">·</span>
            <span>{destination.currency}</span>
          </p>
          <Suspense fallback={<RateLineFallback />}>
            <RateLine currency={destination.currency} />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<CityPhotoFallback />}>
        <CityPhoto wikidataId={destination.wikidataId} cityName={destination.nameTr} />
      </Suspense>
    </header>
  );
}
