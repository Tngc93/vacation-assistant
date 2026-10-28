"use client";

import { ExternalLink, X } from "lucide-react";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { EVENT_TYPE_LABELS } from "@/lib/events/file";
import { eventItemId, tripEventCaption, type TripEvent } from "@/lib/events/trip";
import { googleMapsUrl } from "@/components/places/PlaceCard";

const wikipediaCount = new Intl.NumberFormat("tr-TR");

function NewTab() {
  return (
    <>
      <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
      <span className="sr-only">(yeni sekmede açılır)</span>
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
          <Caption>Etkinlik · {EVENT_TYPE_LABELS[event.type]}</Caption>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Ayrıntıyı kapat" className="-mr-1 -mt-1 rounded-sm p-1 text-ink-muted hover:text-ink">
              <X aria-hidden="true" size={16} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </div>

      <Caption as="p" tone={item.kind === "exact" ? "ink" : "warn"} className="mt-2">
        {tripEventCaption(item)}
      </Caption>
      {event.venue ? <p className="mt-2 text-caption text-ink-muted">Yer: {event.venue.name}</p> : null}
      <Caption as="p" tone="warn" className="mt-3">
        Tarihleri resmî kaynaktan doğrula
      </Caption>
      <Caption as="p" tone="sea" className="mt-1">
        Kaynak: Wikidata · Vikipedi&apos;de {wikipediaCount.format(event.wikipedias)} dilde
      </Caption>

      {event.photo ? (
        <p className="mt-3 font-mono text-[0.625rem] leading-snug tracking-[0.02em] text-ink-muted">
          Fotoğraf:{" "}
          <a href={event.photo.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {event.photo.author}
          </a>{" "}
          ·{" "}
          <a href={event.photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
            {event.photo.license}
          </a>{" "}
          · Wikimedia Commons · renkleri düzenlendi
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption">
        {event.website ? (
          <a href={event.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4">
            Resmî site
            <NewTab />
          </a>
        ) : null}
        <a href={`https://www.wikidata.org/wiki/${event.qid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sea underline">
          Wikidata
          <NewTab />
        </a>
        {event.venue ? (
          <a href={googleMapsUrl(event.venue)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sea underline">
            Google Haritalar&apos;da aç
            <NewTab />
          </a>
        ) : null}
      </div>
    </article>
  );
}
