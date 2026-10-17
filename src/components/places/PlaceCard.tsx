"use client";

import { ExternalLink, MapPin } from "lucide-react";
import type { Ref } from "react";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import { describeCuisine } from "@/lib/places/cuisine";
import type { StoredPlace } from "@/lib/places/file";
import { OpeningHours } from "./OpeningHours";

export function googleMapsUrl(place: Pick<StoredPlace, "lat" | "lon">): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat.toFixed(6)}%2C${place.lon.toFixed(6)}`;
}

const wikipediaCount = new Intl.NumberFormat("tr-TR");

export type PlaceCardProps = {
  place: StoredPlace;
  category: CategoryId;
  /** The city's IANA time zone. */
  timeZone: string;
  active: boolean;
  ref?: Ref<HTMLElement>;
  onActivate: (id: string | null) => void;
  onShowOnMap: (id: string) => void;
};

/** One place: name, category, address, optional website and hours, and honest ranking captions. */
export function PlaceCard({ place, category, timeZone, active, ref, onActivate, onShowOnMap }: PlaceCardProps) {
  return (
    <article
      ref={ref}
      id={`mekan-${place.id.replace("/", "-")}`}
      tabIndex={-1}
      onMouseEnter={() => onActivate(place.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(place.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onActivate(null);
      }}
      className={cn(
        "scroll-mt-24 rounded-md border bg-paper-raised p-4 transition-colors duration-150 ease-out md:p-5",
        active ? "border-accent" : "border-rule",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-body font-medium text-ink">{place.name}</h4>
          {place.localName ? <p className="text-caption text-ink-muted">{place.localName}</p> : null}
        </div>
        <Caption className="shrink-0">{CATEGORIES[category].label}</Caption>
      </div>

      {place.address ? <p className="mt-2 text-caption text-ink-muted">{place.address}</p> : null}
      {place.cuisine ? <p className="mt-1 text-caption text-ink-muted">Mutfak: {describeCuisine(place.cuisine)}</p> : null}
      {place.openingHours ? <OpeningHours value={place.openingHours} timeZone={timeZone} /> : null}

      {place.wikipediaCount ? (
        <Caption as="p" tone="sea" className="mt-3">
          Vikipedi&apos;de {wikipediaCount.format(place.wikipediaCount)} dilde
        </Caption>
      ) : null}
      {place.detailed ? (
        <Caption as="p" tone="sea" className="mt-3">
          OSM&apos;de ayrıntılı kayıtlı
        </Caption>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption">
        <button
          type="button"
          onClick={() => onShowOnMap(place.id)}
          className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4"
        >
          <MapPin aria-hidden="true" size={14} strokeWidth={1.5} />
          Haritada göster
        </button>
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sea underline"
        >
          Google Haritalar&apos;da aç
          <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
          <span className="sr-only">(yeni sekmede açılır)</span>
        </a>
        {place.website ? (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sea underline"
          >
            Web sitesi
            <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
