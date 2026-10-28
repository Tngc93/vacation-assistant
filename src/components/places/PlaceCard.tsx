"use client";

import { ExternalLink, MapPin, X } from "lucide-react";
import type { Ref } from "react";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import { describeCuisine } from "@/lib/places/cuisine";
import { farCaption, TRANSIT_CAPTION, transitFromCentre } from "@/lib/places/far";
import type { StoredPlace } from "@/lib/places/file";
import type { ShownPlace } from "@/lib/places/rules";
import { OpeningHours } from "./OpeningHours";

export function googleMapsUrl(place: Pick<StoredPlace, "lat" | "lon">): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat.toFixed(6)}%2C${place.lon.toFixed(6)}`;
}

const wikipediaCount = new Intl.NumberFormat("tr-TR");

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
const regionNames = new Intl.DisplayNames(["tr"], { type: "region" });

export function PlaceCard({ place, category, timeZone, active, ref, onActivate, onShowOnMap, onClose, className }: PlaceCardProps) {
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
            {place.country ? `${(regionNames.of(place.country) ?? place.country).toLocaleUpperCase("tr")} · ` : ""}
            {CATEGORIES[category].label}
          </Caption>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Ayrıntıyı kapat" className="-mr-1 -mt-1 rounded-sm p-1 text-ink-muted hover:text-ink">
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
            {farCaption(place.farKm)}
          </Caption>
          {transitFromCentre(place.farKm) ? (
            <Caption as="p" className="mt-0.5">
              {TRANSIT_CAPTION}
            </Caption>
          ) : null}
        </>
      ) : null}
      {place.cuisine ? <p className="mt-1 text-caption text-ink-muted">Mutfak: {describeCuisine(place.cuisine)}</p> : null}
      {place.openingHours ? <OpeningHours value={place.openingHours} timeZone={timeZone} /> : null}

      {place.wikipediaCount ? (
        <Caption as="p" tone="sea" className="mt-3">
          Vikipedi&apos;de {wikipediaCount.format(place.wikipediaCount)} dilde
        </Caption>
      ) : null}
      {category === "cocktail" && place.wikidataId ? (
        <Caption as="p" tone="sea" className="mt-3">
          Wikidata&apos;da kayıtlı
        </Caption>
      ) : null}
      {place.detailed ? (
        <Caption as="p" tone="sea" className="mt-3">
          OSM&apos;de ayrıntılı kayıtlı
        </Caption>
      ) : null}

      {place.photo ? (
        // The card shows the photo in duotone: CC BY asks us to say it was changed.
        <p className="mt-3 font-mono text-[0.625rem] leading-snug tracking-[0.02em] text-ink-muted">
          Fotoğraf:{" "}
          <a href={place.photo.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {place.photo.author}
          </a>{" "}
          ·{" "}
          <a href={place.photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
            {place.photo.license}
          </a>{" "}
          · Wikimedia Commons · renkleri düzenlendi
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
            Haritada göster
          </button>
        ) : null}
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
