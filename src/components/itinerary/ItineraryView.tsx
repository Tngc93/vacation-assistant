"use client";

import { CalendarPlus, Map as MapIcon, RotateCcw, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AI_PANEL_ID, useAiDrawer, useIsDesktop } from "@/components/ai/AiDrawer";
import { AiPanel } from "@/components/ai/AiPanel";
import { Button, buttonClasses, Caption, Skeleton } from "@/components/ui";
import type { AiPlan } from "@/lib/ai/assistant";
import { applyEdits, diffPlans, encodeEdits, encodePinned, pinnedFromPlan, type EditBatch, type PlanDiff } from "@/lib/ai/edits";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { buildIcs } from "@/lib/itinerary/ics";
import { serializeSkip } from "@/lib/itinerary/ids";
import type { EveningCategory } from "@/lib/itinerary/config";
import { buildItinerary, type DayTag, type Itinerary, type ItineraryInput, type PlanDay, type PlanPlace, type PlanStop } from "@/lib/itinerary/plan";
import { CATEGORIES } from "@/lib/places/categories";
import { withLocative } from "@/lib/places/hours";
import { isoToDate } from "@/lib/search/dates";
import { useNearViewport } from "@/lib/useNearViewport";

const ItineraryMap = dynamic(() => import("./ItineraryMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-md md:h-[28rem]" />,
});

type Props = {
  /** `evening` is ignored: evening places come from `eveningPool` by the chosen categories. */
  input: Omit<ItineraryInput, "skip">;
  initialSkip: string[];
  cityName: string;
  center: { lat: number; lon: number };
  /** Evening places of every evening category, so a chat edit can switch to cocktail bars without a reload. */
  eveningPool?: Partial<Record<EveningCategory, PlanPlace[]>>;
  initialEvening?: EveningCategory[];
  /** `?ai=`: an AI plan's daytime stops per day (full place ids). */
  initialAi?: string[][] | null;
  /** `?edit=`: chat edits, one batch per message. */
  initialEdits?: EditBatch[];
  /** Tests inject a mock provider; the browser calls the provider directly otherwise. */
  aiFetch?: typeof fetch;
  /** The budget's flight is a web-search price: there are no flight times, so the default windows are used. */
  flightTimesUnknown?: boolean;
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

/** How long a day stays marked after the panel changed it (the sheet has closed over it on a phone). */
const FLASH_MS = 2400;

/** The days a chat edit touched. */
function daysInDiff(diff: PlanDiff): number[] {
  return [...diff.added.map((a) => a.day), ...diff.removed.map((r) => r.day), ...diff.moved.flatMap((m) => [m.from, m.to]), ...diff.evening.map((e) => e.day)];
}

/** The days whose daytime stops an AI plan replaces. */
function daysChangedBy(plan: Itinerary, pinned: string[][]): number[] {
  return plan.days
    .filter((d, i) => {
      const before = d.stops.filter((s) => s.kind === "daytime").map((s) => s.id);
      const after = pinned[i] ?? [];
      return before.length !== after.length || before.some((id, j) => id !== after[j]);
    })
    .map((d) => d.number);
}

/**
 * Keeps `?skip=`, `?ai=` and `?edit=` in step with the plan without a server round trip, so the link reopens the
 * same plan. The AI key is never part of it.
 */
function writeParams(values: { skip: string[]; ai: string[][] | null; edits: EditBatch[] }) {
  const params = new URLSearchParams(window.location.search);
  const set = (name: string, value: string) => (value ? params.set(name, value) : params.delete(name));
  set("skip", serializeSkip(values.skip));
  set("ai", values.ai ? encodePinned(values.ai) : "");
  set("edit", encodeEdits(values.edits));
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

function Stop({ stop, number, onRemove }: { stop: PlanStop; number: number; onRemove: (stop: PlanStop) => void }) {
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
        {stop.remote ? (
          <Caption as="p" tone="sea" className="mt-0.5">
            MERKEZE UZAK · TOPLU TAŞIMA ÖNERİLİR
          </Caption>
        ) : null}
        {stop.exterior ? (
          <Caption as="p" tone="sea" className="mt-0.5">
            YALNIZCA DIŞARIDAN
          </Caption>
        ) : null}
        {stop.exterior?.note ? <p className="mt-0.5 text-caption text-ink-muted">{stop.exterior.note}</p> : null}
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
            onClick={() => onRemove(stop)}
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
  reason,
  flash = false,
}: {
  day: PlanDay;
  selected: boolean;
  /** Just changed by the AI panel: marked for a moment. */
  flash?: boolean;
  onSelect: () => void;
  onRemove: (stop: PlanStop) => void;
  /** The model's one or two sentences for the day (plain text). */
  reason?: string;
}) {
  return (
    <section
      aria-label={`${day.number}. gün · ${dayLabel(day.date)}`}
      data-changed={flash || undefined}
      className={cn(
        "-mx-3 break-inside-avoid rounded-md border-t border-rule px-3 pt-6 transition-colors duration-700 ease-out first:border-t-0 first:pt-0",
        flash ? "bg-paper-raised ring-1 ring-accent" : "ring-0 ring-transparent",
      )}
    >
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
      {reason ? (
        <div className="mt-4 border-l-2 border-sea pl-3">
          <Caption as="p" tone="sea">
            YAPAY ZEKÂ GEREKÇESİ
          </Caption>
          <p className="mt-1 whitespace-pre-line text-caption text-ink">{reason}</p>
        </div>
      ) : null}
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
export function ItineraryView({
  input,
  initialSkip,
  cityName,
  center,
  eveningPool,
  initialEvening = [],
  initialAi = null,
  initialEdits = [],
  aiFetch,
  flightTimesUnknown = false,
}: Props) {
  const [skip, setSkip] = useState(initialSkip);
  const [ai, setAi] = useState<{ pinned: string[][]; reasons: Record<number, string>; source: string | null } | null>(
    initialAi ? { pinned: initialAi, reasons: {}, source: null } : null,
  );
  const [edits, setEdits] = useState<EditBatch[]>(initialEdits);
  const [reply, setReply] = useState<string | null>(null);
  const eveningFor = useMemo(
    () => (categories: readonly EveningCategory[]) =>
      eveningPool ? categories.flatMap((c) => eveningPool[c] ?? []) : input.evening,
    [eveningPool, input.evening],
  );
  const known = useMemo(() => new Set(input.daytime.map((p) => p.id)), [input.daytime]);
  /** The deterministic plan, then the AI plan and the chat edits on top of it (each batch undoable). */
  const build = useMemo(
    () => (batches: readonly EditBatch[]) => {
      const base = buildItinerary({ ...input, evening: eveningFor(initialEvening), skip });
      if (!ai && !batches.length) return { plan: base, pace: "normal" as const, evening: initialEvening };
      const state = applyEdits({ pinned: ai?.pinned ?? pinnedFromPlan(base), pace: "normal", evening: initialEvening }, batches, known);
      return {
        plan: buildItinerary({ ...input, evening: eveningFor(state.evening), skip, pinned: state.pinned, pace: state.pace }),
        pace: state.pace,
        evening: state.evening,
      };
    },
    [input, eveningFor, initialEvening, skip, ai, known],
  );
  const current = useMemo(() => build(edits), [build, edits]);
  const plan = current.plan;
  const lastChange = useMemo(
    () => (edits.length && reply !== null ? { diff: diffPlans(build(edits.slice(0, -1)).plan, plan), reply } : null),
    [build, edits, plan, reply],
  );
  const firstWithStops = plan.days.find((d) => d.stops.length)?.number ?? 1;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const day = plan.days.find((d) => d.number === (selectedDay ?? firstWithStops)) ?? plan.days[0];
  const isWide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 48rem)").matches, () => false);
  const [mapBox, mapNear] = useNearViewport<HTMLDivElement>("200px");
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

  const drawer = useAiDrawer();
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<number[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (drawer.open) panelRef.current?.focus({ preventScroll: true });
  }, [drawer.open]);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  // The sheet covers the page on a phone: the page underneath does not scroll while it is open.
  const sheetOpen = drawer.open && !isDesktop;
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);
  /** After the panel changed the plan: mark the days; on a phone close the sheet and bring the first one into view. */
  const showChange = (days: number[]) => {
    drawer.setChanged(true);
    const unique = [...new Set(days)].sort((a, b) => a - b);
    setFlash(unique);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash([]), FLASH_MS);
    if (!isDesktop) {
      drawer.close();
      const first = unique[0];
      if (first) requestAnimationFrame(() => document.getElementById(`gun-${first}`)?.scrollIntoView({ block: "start" }));
    }
  };

  const save = (next: { skip?: string[]; ai?: typeof ai; edits?: EditBatch[] }) => {
    const values = { skip: next.skip ?? skip, ai: next.ai === undefined ? ai : next.ai, edits: next.edits ?? edits };
    if (next.skip) setSkip(next.skip);
    if (next.ai !== undefined) setAi(next.ai);
    if (next.edits) setEdits(next.edits);
    writeParams({ skip: values.skip, ai: values.ai?.pinned ?? null, edits: values.edits });
  };
  const edited = ai !== null || edits.length > 0;
  // On an AI or edited plan, removing is an edit too (undoable); on the deterministic plan it is `?skip=`.
  const remove = (stop: PlanStop) => {
    if (edited && stop.kind === "daytime") {
      setReply(null);
      save({ edits: [...edits, [{ op: "remove", id: stop.id }]] });
    } else save({ skip: [...new Set([...skip, stop.shortId])] });
  };
  const reset = () => {
    setReply(null);
    drawer.setChanged(false);
    save({ skip: [], ai: null, edits: [] });
  };
  const onAiPlan = (next: AiPlan, source: string) => {
    setReply(null);
    save({ ai: { ...next, source }, edits: [] });
    showChange(daysChangedBy(plan, next.pinned));
  };
  const onEdit = (batch: EditBatch, text: string) => {
    const nextEdits = [...edits, batch];
    setReply(text);
    save({ edits: nextEdits });
    showChange(daysInDiff(diffPlans(plan, build(nextEdits).plan)));
  };
  const undo = () => {
    setReply(null);
    drawer.setChanged(ai?.source != null);
    save({ edits: edits.slice(0, -1) });
  };
  const changes = skip.length + edits.length + (ai ? 1 : 0);
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

  const sidePanel = drawer.open && isDesktop;

  return (
    <div className={cn(sidePanel && "grid grid-cols-[minmax(0,1fr)_26.25rem] items-start gap-8")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            {flightTimesUnknown ? (
              <Caption as="p" tone="warn">
                UÇUŞ SAATİ BİLİNMİYOR · VARSAYILAN SAATLER
              </Caption>
            ) : plan.basis === "flight" && flight ? (
              <Caption as="p" tone="ink">
                UÇUŞ: {flight.label.toLocaleUpperCase("tr")} · VARIŞ {flight.arrive?.time} · DÖNÜŞ KALKIŞI {flight.leave?.time} · SAATLER{" "}
                {cityName.toLocaleUpperCase("tr")} SAATİYLE
              </Caption>
            ) : (
              <Caption as="p" tone="warn">
                UÇUŞ SEÇİLMEDİ · VARSAYIM: İLK GÜN 13:00 SONRASI, SON GÜN 13:00 ÖNCESİ · SAATLER {cityName.toLocaleUpperCase("tr")} SAATİYLE
              </Caption>
            )}
            {ai ? (
              <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-muted">
                <Sparkles aria-hidden="true" size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                <span>
                  Duraklar yapay zekâ{ai.source ? ` (${ai.source})` : ""} tarafından bu şehrin listesinden seçildi ve sıralandı; saatler, açılış
                  kontrolü ve yürüme tahminini uygulama hesapladı.
                  {ai.source ? "" : " Gerekçeler yalnızca planı kuran tarayıcıda görünür."}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-caption text-ink-muted">
                Duraklar Vikipedi&apos;deki dil sayısına ve yakınlığa göre seçildi; süreler ve yürüme tahminidir.
                {edits.length ? " Sohbetle düzenlendi." : " Yapay zekâ kullanılmadı."}
              </p>
            )}
            <p className="mt-1 text-caption text-ink-muted">Saat bilgisi olmayan mekânlar işaretlidir; gitmeden kontrol et.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={download}>
              <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.5} />
              Takvime ekle (.ics)
            </Button>
            {changes ? (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" size={16} strokeWidth={1.5} />
                Planı sıfırla ({changes})
              </Button>
            ) : null}
          </div>
        </div>

        {plan.dropped.length ? (
          <p className="mt-4 text-caption text-ink-muted">
            Önerilen {plan.dropped.length} yer saat, açılış ya da günün süresi yüzünden plana sığmadı ve dışarıda kaldı.
          </p>
        ) : null}

        {/* With the side panel open the days keep the left, narrower: the map moves under them. */}
        <div className={cn("mt-8 grid gap-10 print:block", !sidePanel && "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start")}>
          <div className="grid min-w-0 gap-8">
            {plan.days.map((d) => (
              <Day
                key={d.number}
                day={d}
                selected={d.number === day.number}
                onSelect={() => selectDay(d.number)}
                onRemove={remove}
                reason={ai?.reasons[d.number]}
                flash={flash.includes(d.number)}
              />
            ))}
          </div>
          <div ref={mapRef} className={cn("min-w-0 scroll-mt-6 print:hidden", !sidePanel && "md:sticky md:top-6")}>
            {/* Always rendered, so the in-view check has an element from the first render on. */}
            <div ref={mapBox}>
              {isWide || mapOnPhone ? (
                <>
                  <Caption as="p" className="mb-2">
                    {String(day.number).padStart(2, "0")}. GÜN · {dayLabel(day.date)} · {day.stops.length} DURAK
                  </Caption>
                  {/* MapLibre starts when the map comes into view, not with the page. */}
                  {mapNear || mapOnPhone ? (
                    <ItineraryMap stops={day.stops} center={center} />
                  ) : (
                    <Skeleton className="h-80 w-full rounded-md md:h-[28rem]" />
                  )}
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
      </div>

      {/*
        After the days in the page order. Closed, it stays mounted (hidden), so a typed request or a status survives.
        Desktop: a side column, not modal; phones: a full-screen sheet from the bottom.
      */}
      <div
        id={AI_PANEL_ID}
        ref={panelRef}
        tabIndex={-1}
        hidden={!drawer.open}
        role={sheetOpen ? "dialog" : undefined}
        aria-modal={sheetOpen ? true : undefined}
        aria-labelledby={sheetOpen ? "ai-title" : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            drawer.close();
          }
        }}
        className={cn(
          "outline-none print:hidden",
          sidePanel && "sticky top-14 max-h-[calc(100svh-4.5rem)] overflow-y-auto motion-safe:animate-panel-in",
          sheetOpen && "fixed inset-0 z-50 overflow-y-auto bg-paper p-4 motion-safe:animate-sheet-in",
        )}
      >
        <AiPanel
          plan={plan}
          daytime={input.daytime}
          skip={skip}
          cityName={cityName}
          pace={current.pace}
          evening={current.evening}
          onPlan={onAiPlan}
          onEdit={onEdit}
          onUndo={undo}
          canUndo={edits.length > 0}
          lastChange={lastChange}
          fetcher={aiFetch}
          onClose={drawer.close}
        />
      </div>
    </div>
  );
}
