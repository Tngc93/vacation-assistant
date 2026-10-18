"use client";

import { CalendarPlus, Map as MapIcon, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, buttonClasses, Caption, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { buildIcs } from "@/lib/itinerary/ics";
import { serializeSkip } from "@/lib/itinerary/ids";
import { buildItinerary, type DayTag, type ItineraryInput, type PlanDay, type PlanStop } from "@/lib/itinerary/plan";
import { CATEGORIES } from "@/lib/places/categories";
import { withLocative } from "@/lib/places/hours";
import { isoToDate } from "@/lib/search/dates";

const ItineraryMap = dynamic(() => import("./ItineraryMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-md md:h-[28rem]" />,
});

type Props = {
  input: Omit<ItineraryInput, "skip">;
  initialSkip: string[];
  cityName: string;
  center: { lat: number; lon: number };
};

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 48rem)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

const regionNames = new Intl.DisplayNames(["tr"], { type: "region" });
/** "VATİKAN" for VA. */
const countryName = (code: string) => (regionNames.of(code) ?? code).toLocaleUpperCase("tr");

/** "14 KAS CMT" */
const dayLabel = (iso: string) => formatDay(isoToDate(iso)).toLocaleUpperCase("tr");

function durationText(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h} sa ${m} dk` : h ? `${h} sa` : `${m} dk`;
}

/** Keeps `?skip=` in step with the plan without a server round trip, so the link reopens the same plan. */
function writeSkip(skip: string[]) {
  const params = new URLSearchParams(window.location.search);
  if (skip.length) params.set("skip", serializeSkip(skip));
  else params.delete("skip");
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

function TravelLine({ stop }: { stop: PlanStop }) {
  if (!stop.travel) return null;
  return (
    <li aria-hidden={false} className="relative pb-3 pl-[4.75rem] md:pl-24">
      <Caption as="p">
        YÜRÜME ~{stop.travel.walkMin} DK · TAHMİNİ
        {stop.travel.transit ? " · TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR" : ""}
      </Caption>
    </li>
  );
}

function Stop({ stop, number, onRemove }: { stop: PlanStop; number: number; onRemove: (shortId: string) => void }) {
  return (
    <li className="relative grid grid-cols-[4rem_minmax(0,1fr)] gap-3 pb-5 md:grid-cols-[5rem_minmax(0,1fr)]">
      <p className="pt-0.5 font-mono text-caption tabular text-ink">
        {stop.start}
        <span className="block text-ink-muted">{stop.end}</span>
      </p>
      <div className="relative min-w-0 border-l border-rule pl-4">
        <span
          aria-hidden="true"
          className={cn(
            "absolute -left-[0.6875rem] top-0.5 flex size-5 items-center justify-center rounded-full font-mono text-[0.625rem]",
            stop.kind === "evening" ? "bg-paper-raised text-ink ring-1 ring-ink" : "bg-ink text-paper-raised",
          )}
        >
          {number}
        </span>
        <p className="text-body font-medium">
          {stop.name}
          {stop.localName && stop.localName !== stop.name ? <span className="font-normal text-ink-muted"> · {stop.localName}</span> : null}
        </p>
        <Caption as="p" className="mt-0.5">
          {stop.country ? `${countryName(stop.country)} · ` : ""}
          {stop.kind === "evening" ? "AKŞAM · " : ""}
          {CATEGORIES[stop.category].label.toLocaleUpperCase("tr")} · {durationText(stop.durationMin).toLocaleUpperCase("tr")} · TAHMİNİ
        </Caption>
        {stop.closesSoon ? (
          <Caption as="p" tone="warn" className="mt-0.5">
            KAPANIŞA YAKIN · {withLocative(stop.closesSoon).toLocaleUpperCase("tr")} KAPANIR
          </Caption>
        ) : null}
        {/* Unknown hours are common; a quiet note, not a warning (the plan's intro explains it). */}
        {stop.hours === "unknown" ? (
          <Caption as="p" className="mt-0.5">
            SAATLERİ DOĞRULA
          </Caption>
        ) : null}
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption print:hidden">
          <a href={stop.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {stop.source}
          </a>
          <button
            type="button"
            onClick={() => onRemove(stop.shortId)}
            className="inline-flex items-center gap-1 text-ink-muted underline underline-offset-4 hover:text-ink"
            aria-label={`${stop.name} durağını plandan çıkar`}
          >
            <X aria-hidden="true" size={12} strokeWidth={1.5} />
            Çıkar
          </button>
        </p>
      </div>
    </li>
  );
}

/** Unplanned time before the evening place: shown, never filled with made-up stops. */
function FreeTime({ free }: { free: { start: string; end: string } }) {
  return (
    <li className="relative grid grid-cols-[4rem_minmax(0,1fr)] gap-3 pb-5 md:grid-cols-[5rem_minmax(0,1fr)]">
      <p className="font-mono text-caption tabular text-ink-muted">
        {free.start}
        <span className="block">{free.end}</span>
      </p>
      <div className="border-l border-dashed border-rule pl-4">
        <Caption as="p">
          SERBEST ZAMAN · {free.start}–{free.end}
        </Caption>
      </div>
    </li>
  );
}

function tagText(tags: DayTag[]) {
  return tags.join(" · ");
}

function Day({
  day,
  selected,
  onSelect,
  onRemove,
}: {
  day: PlanDay;
  selected: boolean;
  onSelect: () => void;
  onRemove: (shortId: string) => void;
}) {
  return (
    <section aria-label={`${day.number}. gün · ${dayLabel(day.date)}`} className="break-inside-avoid border-t border-rule pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h3 id={`gun-${day.number}`} className="flex items-end gap-4">
          <span aria-hidden="true" className="font-display text-display leading-none">
            {String(day.number).padStart(2, "0")}
          </span>
          <span className="sr-only">{day.number}. gün</span>
          <span className="pb-1.5">
            <Caption as="span" tone="ink" className="block">
              {dayLabel(day.date)}
            </Caption>
            <Caption as="span" className="mt-0.5 block">
              {tagText(day.tags)}
              {day.window ? ` · ${day.window.start}–${day.window.end}` : ""}
            </Caption>
          </span>
        </h3>
        {day.stops.length ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn("text-caption underline-offset-4 print:hidden", selected ? "text-ink" : "text-ink-muted underline hover:text-ink")}
          >
            {selected ? "Haritada gösteriliyor" : "Haritada göster"}
          </button>
        ) : null}
      </div>
      {day.note ? (
        <div className="mt-4">
          <p className="text-body text-ink-muted">{day.note}</p>
          {day.flightNote ? (
            <a href="#ucuslar" className="mt-1 inline-block text-caption underline underline-offset-4 print:hidden">
              Daha uygun saatli uçuşlara bak
            </a>
          ) : null}
        </div>
      ) : null}
      {day.stops.length ? (
        <ol className="mt-5">
          {day.stops.flatMap((stop, i) => [
            ...(stop.kind === "evening" && day.free ? [<FreeTime key="free" free={day.free} />] : []),
            <TravelLine key={`${stop.id}-travel`} stop={stop} />,
            <Stop key={stop.id} stop={stop} number={i + 1} onRemove={onRemove} />,
          ])}
        </ol>
      ) : null}
    </section>
  );
}

/** DESIGN.md "Itinerary": a huge Fraunces numeral per day, a vertical timeline, and the selected day on the map. */
export function ItineraryView({ input, initialSkip, cityName, center }: Props) {
  const [skip, setSkip] = useState(initialSkip);
  const plan = useMemo(() => buildItinerary({ ...input, skip }), [input, skip]);
  const firstWithStops = plan.days.find((d) => d.stops.length)?.number ?? 1;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const day = plan.days.find((d) => d.number === (selectedDay ?? firstWithStops)) ?? plan.days[0];
  const isWide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 48rem)").matches, () => false);
  const [mapOnPhone, setMapOnPhone] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  // Bumped when a day is chosen on a phone, where the map sits below all days; the effect scrolls to it after render.
  const [mapScroll, setMapScroll] = useState(0);
  useEffect(() => {
    if (mapScroll > 0) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mapScroll]);
  const selectDay = (number: number) => {
    setSelectedDay(number);
    if (!isWide) {
      setMapOnPhone(true);
      setMapScroll((n) => n + 1);
    }
  };

  const update = (next: string[]) => {
    setSkip(next);
    writeSkip(next);
  };
  const remove = (shortId: string) => update([...new Set([...skip, shortId])]);
  const download = () => {
    const ics = buildIcs(plan, { cityName, now: new Date() });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cityName.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]+/g, "-")}-gezi-plani.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const flight = input.flight;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          {plan.basis === "flight" && flight ? (
            <Caption as="p" tone="ink">
              UÇUŞ: {flight.label.toLocaleUpperCase("tr")} · VARIŞ {flight.arrive?.time} · DÖNÜŞ KALKIŞI {flight.leave?.time} · SAATLER{" "}
              {cityName.toLocaleUpperCase("tr")} SAATİYLE
            </Caption>
          ) : (
            <Caption as="p" tone="warn">
              UÇUŞ SEÇİLMEDİ · VARSAYIM: İLK GÜN 13:00 SONRASI, SON GÜN 13:00 ÖNCESİ · SAATLER {cityName.toLocaleUpperCase("tr")} SAATİYLE
            </Caption>
          )}
          <p className="mt-2 text-caption text-ink-muted">
            Duraklar Vikipedi&apos;deki dil sayısına ve yakınlığa göre seçildi; süreler ve yürüme tahminidir. Yapay zekâ kullanılmadı.
          </p>
          <p className="mt-1 text-caption text-ink-muted">Saat bilgisi olmayan mekânlar işaretlidir; gitmeden kontrol et.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" onClick={download}>
            <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.5} />
            Takvime ekle (.ics)
          </Button>
          {skip.length ? (
            <Button variant="ghost" onClick={() => update([])}>
              <RotateCcw aria-hidden="true" size={16} strokeWidth={1.5} />
              Planı sıfırla ({skip.length})
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start print:block">
        <div className="grid min-w-0 gap-8">
          {plan.days.map((d) => (
            <Day key={d.number} day={d} selected={d.number === day.number} onSelect={() => selectDay(d.number)} onRemove={remove} />
          ))}
        </div>
        <div ref={mapRef} className="min-w-0 scroll-mt-6 print:hidden md:sticky md:top-6">
          {isWide || mapOnPhone ? (
            <>
              <Caption as="p" className="mb-2">
                {String(day.number).padStart(2, "0")}. GÜN · {dayLabel(day.date)} · {day.stops.length} DURAK
              </Caption>
              <ItineraryMap stops={day.stops} center={center} />
            </>
          ) : (
            <button type="button" className={buttonClasses({ variant: "secondary", className: "w-full" })} onClick={() => setMapOnPhone(true)}>
              <MapIcon aria-hidden="true" size={16} strokeWidth={1.5} />
              Günün haritasını göster
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
