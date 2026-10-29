"use client";

import { ExternalLink, MapPin, X } from "lucide-react";
import type { Ref } from "react";
import { Caption } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { CategoryId } from "@/lib/places/categories";
import { describeCuisine } from "@/lib/places/cuisine";
import { farCaption, transitFromCentre } from "@/lib/places/far";
import type { StoredPlace } from "@/lib/places/file";
import type { ShownPlace } from "@/lib/places/rules";
import { OpeningHours } from "./OpeningHours";

export function googleMapsUrl(place: Pick<StoredPlace, "lat" | "lon">): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat.toFixed(6)}%2C${place.lon.toFixed(6)}`;
}

export type PlaceCardProps = {
  place: StoredPlace & Pick<ShownPlace, "farKm">;
  category: CategoryId;
  /** The city's IANA time zone. */
  timeZone: string;
  active: boolean;
  ref?: Ref<HTMLElement>;
  onActivate: (id: string | null) => void;
  /** Shown as "Haritada göster" when the map is elsewhere on the page. */
  onShowOnMap?: (id: string) => void;
  /** Shown as a close button when the card is a detail panel. */
  onClose?: () => void;
  className?: string;
};

/** One place: name, category, address, optional website and hours, and honest ranking captions. */
export function PlaceCard({ place, category, timeZone, active, ref, onActivate, onShowOnMap, onClose, className }: PlaceCardProps) {
  const i18n = useI18n();
  const { locale, intl, m, f } = i18n;
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
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-body font-medium text-ink">{place.name}</h4>
          {place.localName ? <p className="text-caption text-ink-muted">{place.localName}</p> : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <Caption>
            {place.country ? `${(new Intl.DisplayNames([intl], { type: "region" }).of(place.country) ?? place.country).toLocaleUpperCase(intl)} · ` : ""}
            {m.categories[category]}
          </Caption>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label={m.common.closeDetail} className="-mr-1 -mt-1 rounded-sm p-1 text-ink-muted hover:text-ink">
              <X aria-hidden="true" size={16} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </div>

      {place.description ? <p className="mt-2 text-caption text-ink">{place.description}</p> : null}
      {place.address ? <p className="mt-2 text-caption text-ink-muted">{place.address}</p> : null}
      {place.farKm !== undefined ? (
        <>
          <Caption as="p" tone="sea" className="mt-2">
            {farCaption(place.farKm, i18n)}
          </Caption>
          {transitFromCentre(place.farKm) ? (
            <Caption as="p" className="mt-0.5">
              {m.places.transit}
            </Caption>
          ) : null}
        </>
      ) : null}
      {place.cuisine ? (
        <p className="mt-1 text-caption text-ink-muted">{f(m.places.cuisine, { cuisine: describeCuisine(place.cuisine, locale) })}</p>
      ) : null}
      {place.openingHours ? <OpeningHours value={place.openingHours} timeZone={timeZone} /> : null}

      {place.wikipediaCount ? (
        <Caption as="p" tone="sea" className="mt-3">
          {f(m.places.wikipediaLanguages, { count: place.wikipediaCount })}
        </Caption>
      ) : null}
      {category === "cocktail" && place.wikidataId ? (
        <Caption as="p" tone="sea" className="mt-3">
          {m.places.onWikidata}
        </Caption>
      ) : null}
      {place.detailed ? (
        <Caption as="p" tone="sea" className="mt-3">
          {m.places.detailedInOsm}
        </Caption>
      ) : null}

      {place.photo ? (
        // The card shows the photo in duotone: CC BY asks us to say it was changed.
        <p className="mt-3 font-mono text-[0.625rem] leading-snug tracking-[0.02em] text-ink-muted">
          {m.city.photo}{" "}
          <a href={place.photo.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {place.photo.author}
          </a>{" "}
          ·{" "}
          <a href={place.photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
            {place.photo.license}
          </a>{" "}
          · Wikimedia Commons · {m.city.recoloured}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption">
        {onShowOnMap ? (
          <button
            type="button"
            onClick={() => onShowOnMap(place.id)}
            className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4"
          >
            <MapPin aria-hidden="true" size={14} strokeWidth={1.5} />
            {m.places.showOnMap}
          </button>
        ) : null}
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sea underline"
        >
          {m.common.openInGoogleMaps}
          <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
          <span className="sr-only">{m.common.newTab}</span>
        </a>
        {place.website ? (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sea underline"
          >
            {m.common.website}
            <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
            <span className="sr-only">{m.common.newTab}</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
