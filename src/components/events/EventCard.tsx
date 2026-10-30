"use client";

import { ExternalLink, X } from "lucide-react";
import { Caption } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { eventItemId, tripEventCaption, type TripEvent } from "@/lib/events/trip";
import { googleMapsUrl } from "@/components/places/PlaceCard";

function NewTab() {
  const { m } = useI18n();
  return (
    <>
      <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
      <span className="sr-only">{m.common.newTab}</span>
    </>
  );
}

/**
 * One event in the trip (DESIGN.md "Event card"): name, type, the dates (exact, or "GENELDE …" with "TARİHİ
 * DOĞRULA"), the venue, the source (Wikidata), the official site when there is one, and always "Tarihleri resmî
 * kaynaktan doğrula".
 */
export function EventCard({
  item,
  active,
  onActivate,
  onClose,
  className,
}: {
  item: TripEvent;
  active: boolean;
  onActivate: (id: string | null) => void;
  onClose?: () => void;
  className?: string;
}) {
  const i18n = useI18n();
  const { m, f } = i18n;
  const { event } = item;
  const id = eventItemId(event);
  return (
    <article
      id={`etkinlik-${event.qid}`}
      tabIndex={-1}
      onMouseEnter={() => onActivate(id)}
      onMouseLeave={() => onActivate(null)}
      className={cn("rounded-md border bg-paper-raised p-4 transition-colors duration-150 ease-out md:p-5", active ? "border-accent" : "border-rule", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-body font-medium text-ink">{event.name}</h4>
          {event.localName ? <p className="text-caption text-ink-muted">{event.localName}</p> : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <Caption>{f(m.places.eventType, { type: m.events.types[event.type] })}</Caption>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label={m.common.closeDetail} className="-mr-1 -mt-1 rounded-sm p-1 text-ink-muted hover:text-ink">
              <X aria-hidden="true" size={16} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </div>

      <Caption as="p" tone={item.kind === "exact" ? "ink" : "warn"} className="mt-2">
        {tripEventCaption(item, i18n)}
      </Caption>
      {event.venue ? <p className="mt-2 text-caption text-ink-muted">{f(m.places.venue, { name: event.venue.name })}</p> : null}
      <Caption as="p" tone="warn" className="mt-3">
        {m.places.checkDates}
      </Caption>
      <Caption as="p" tone="sea" className="mt-1">
        {f(m.places.eventSource, { count: event.wikipedias })}
      </Caption>

      {event.photo ? (
        <p className="mt-3 font-mono text-[0.625rem] leading-snug tracking-[0.02em] text-ink-muted">
          {m.city.photo}{" "}
          <a href={event.photo.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {event.photo.author}
          </a>{" "}
          ·{" "}
          <a href={event.photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
            {event.photo.license}
          </a>{" "}
          · Wikimedia Commons · {m.city.recoloured}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption">
        {event.website ? (
          <a href={event.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4">
            {m.places.officialSite}
            <NewTab />
          </a>
        ) : null}
        <a href={`https://www.wikidata.org/wiki/${event.qid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sea underline">
          Wikidata
          <NewTab />
        </a>
        {event.venue ? (
          <a href={googleMapsUrl(event.venue)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sea underline">
            {m.common.openInGoogleMaps}
            <NewTab />
          </a>
        ) : null}
      </div>
    </article>
  );
}
