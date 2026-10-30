"use client";

import { useI18n } from "@/i18n/client";
import { MAP_ATTRIBUTION } from "@/lib/places/mapStyle";

/** Our own map attribution: every source named once (see MAP_ATTRIBUTION), OpenStreetMap's in the interface language. */
export function MapAttribution() {
  const { m } = useI18n();
  return (
    <p className="absolute bottom-0 right-0 z-10 max-w-full rounded-tl-sm bg-paper-raised/90 px-2 py-0.5 text-[0.6875rem] text-ink-muted">
      {MAP_ATTRIBUTION.map((source, index) => (
        <span key={source.href}>
          {index > 0 ? " · " : null}
          <a href={source.href} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            {source.label ?? m.places.osmContributors}
          </a>
        </span>
      ))}
    </p>
  );
}
