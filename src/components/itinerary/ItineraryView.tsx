"use client";

import { CalendarDays, CalendarPlus, Map as MapIcon, RotateCcw, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AI_PANEL_ID, useAiDrawer, useIsDesktop } from "@/components/ai/AiDrawer";
import { AiPanel } from "@/components/ai/AiPanel";
import { Button, buttonClasses, Caption, Skeleton } from "@/components/ui";
import type { AiPlan } from "@/lib/ai/assistant";
import { applyEdits, diffPlans, encodeEdits, encodePinned, pinnedFromPlan, type EditBatch, type PlanDiff } from "@/lib/ai/edits";
import { useI18n } from "@/i18n/client";
import type { I18n } from "@/i18n/i18n";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { buildIcs } from "@/lib/itinerary/ics";
import { serializeSkip } from "@/lib/itinerary/ids";
import type { EveningCategory } from "@/lib/itinerary/config";
import { buildItinerary, type DayNote, type DayTag, type Itinerary, type ItineraryInput, type PlanDay, type PlanPlace, type PlanStop, type PlanSubStop } from "@/lib/itinerary/plan";
import { farCaption, transitFromCentre } from "@/lib/places/far";
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
  /** ISO date → "Bugün şehirde: Oktoberfest · Theresienwiese" (src/lib/events/trip.ts `dayNotes`); never a stop. */
  eventNotes?: Record<string, string[]>;
};

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 48rem)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

type Lang = Pick<I18n, "locale" | "intl" | "m" | "f">;

/** "VATİKAN" ("VATICAN CITY") for VA. */
const countryName = (code: string, { intl }: Pick<Lang, "intl">) =>
  (new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? code).toLocaleUpperCase(intl);

/** "14 KAS CMT" ("14 NOV SAT") */
const dayLabel = (iso: string, { locale, intl }: Pick<Lang, "locale" | "intl">) => formatDay(isoToDate(iso), locale).toLocaleUpperCase(intl);

function durationText(minutes: number, { m, f }: Pick<Lang, "m" | "f">) {
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  const t = m.itinerary;
  return h && min ? f(t.hoursMinutes, { h, m: min }) : h ? f(t.hours, { h }) : f(t.minutes, { m: min });
}

/** A day's note in the interface language; the Turkish time takes its locative suffix ("13:30'da"). */
function noteText(note: DayNote, { locale, m, f }: Pick<Lang, "locale" | "m" | "f">): string {
  const t = m.itinerary.notes;
  if (note.kind === "noTime" || note.kind === "noneOpen") return t[note.kind];
  const time = locale === "tr" ? withLocative(note.time) : note.time;
  const key = note.kind === "arrive" ? (note.evening ? "arriveEvening" : "arrive") : note.evening ? "leaveEvening" : "leave";
  return f(t[key], { time });
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
  const { m, f } = useI18n();
  if (!stop.travel) return null;
  return (
    <li aria-hidden={false} className="relative pb-3 pl-[4.75rem] md:pl-24">
      <Caption as="p">
        {f(m.itinerary.walk, { min: stop.travel.walkMin })}
        {stop.travel.transit ? ` · ${m.places.transit}` : ""}
      </Caption>
    </li>
  );
}

function SourceAndRemove({ stop, onRemove }: { stop: Pick<PlanStop, "name" | "sourceUrl" | "source">; onRemove: () => void }) {
  const { m, f } = useI18n();
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption print:hidden">
      <a href={stop.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        {stop.source}
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1 text-ink-muted underline underline-offset-4 hover:text-ink"
        aria-label={f(m.itinerary.removeLabel, { name: stop.name })}
      >
        <X aria-hidden="true" size={12} strokeWidth={1.5} />
        {m.itinerary.remove}
      </button>
    </p>
  );
}

/** A place inside the stop (the Tsar Bell in the Kremlin): indented under it, seen during its visit, no time of its own. */
function SubStop({ sub, onRemove }: { sub: PlanSubStop; onRemove: (sub: PlanSubStop) => void }) {
  const { intl, m, f } = useI18n();
  return (
    <li className="relative border-l border-rule pl-3">
      <p className="text-body">
        {sub.name}
        {sub.localName && sub.localName !== sub.name ? <span className="text-ink-muted"> · {sub.localName}</span> : null}
      </p>
      <Caption as="p" className="mt-0.5">
        {f(m.places.inside, { name: sub.within.toLocaleUpperCase(intl) })} · {m.categories[sub.category].toLocaleUpperCase(intl)}
        {sub.hours === "unknown" ? ` · ${m.itinerary.checkHours}` : ""}
      </Caption>
      <SourceAndRemove stop={sub} onRemove={() => onRemove(sub)} />
    </li>
  );
}

function Stop({
  stop,
  number,
  onRemove,
  onRemoveInside,
}: {
  stop: PlanStop;
  number: number;
  onRemove: (stop: PlanStop) => void;
  onRemoveInside: (sub: PlanSubStop) => void;
}) {
  const i18n = useI18n();
  const { intl, m, f } = i18n;
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
          {stop.country ? `${countryName(stop.country, i18n)} · ` : ""}
          {stop.kind === "evening" ? `${m.itinerary.evening} · ` : ""}
          {m.categories[stop.category].toLocaleUpperCase(intl)} · {durationText(stop.durationMin, i18n).toLocaleUpperCase(intl)} ·{" "}
          {m.itinerary.estimatedCaps}
        </Caption>
        {stop.farKm !== null ? (
          <Caption as="p" tone="sea" className="mt-0.5">
            {farCaption(stop.farKm, i18n)}
          </Caption>
        ) : null}
        {/* The day's first stop has no walking line: the way there starts at the centre. */}
        {stop.farKm !== null && !stop.travel && transitFromCentre(stop.farKm) ? (
          <Caption as="p" className="mt-0.5">
            {m.places.transit}
          </Caption>
        ) : null}
        {stop.exterior ? (
          <Caption as="p" tone="sea" className="mt-0.5">
            {m.itinerary.exteriorOnly}
          </Caption>
        ) : null}
        {stop.exterior?.note ? <p className="mt-0.5 text-caption text-ink-muted">{stop.exterior.note}</p> : null}
        {stop.closesSoon ? (
          <Caption as="p" tone="warn" className="mt-0.5">
            {f(m.itinerary.closesSoon, { time: (i18n.locale === "tr" ? withLocative(stop.closesSoon) : stop.closesSoon).toLocaleUpperCase(intl) })}
          </Caption>
        ) : null}
        {/* Unknown hours are common; a quiet note, not a warning (the plan's intro explains it). */}
        {stop.hours === "unknown" ? (
          <Caption as="p" className="mt-0.5">
            {m.itinerary.checkHours}
          </Caption>
        ) : null}
        <SourceAndRemove stop={stop} onRemove={() => onRemove(stop)} />
        {stop.inside?.length ? (
          <ul aria-label={f(m.itinerary.insideList, { name: stop.name })} className="mt-3 grid gap-3">
            {stop.inside.map((sub) => (
              <SubStop key={sub.id} sub={sub} onRemove={onRemoveInside} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** Unplanned time before the evening place: shown, never filled with made-up stops. */
function FreeTime({ free }: { free: { start: string; end: string } }) {
  const { m, f } = useI18n();
  return (
    <li className="relative grid grid-cols-[4rem_minmax(0,1fr)] gap-3 pb-5 md:grid-cols-[5rem_minmax(0,1fr)]">
      <p className="font-mono text-caption tabular text-ink-muted">
        {free.start}
        <span className="block">{free.end}</span>
      </p>
      <div className="border-l border-dashed border-rule pl-4">
        <Caption as="p">
          {f(m.itinerary.freeTime, free)}
        </Caption>
      </div>
    </li>
  );
}

function tagText(tags: DayTag[], { m }: Pick<Lang, "m">) {
  return tags.map((tag) => m.itinerary.tags[tag]).join(" · ");
}

function Day({
  day,
  selected,
  onSelect,
  onRemove,
  onRemoveInside,
  reason,
  events,
  flash = false,
}: {
  day: PlanDay;
  selected: boolean;
  /** Just changed by the AI panel: marked for a moment. */
  flash?: boolean;
  onSelect: () => void;
  onRemove: (stop: PlanStop) => void;
  onRemoveInside: (sub: PlanSubStop) => void;
  /** The model's one or two sentences for the day (plain text). */
  reason?: string;
  /** Events in town that day (exact dates only). */
  events?: string[];
}) {
  const i18n = useI18n();
  const { m, f } = i18n;
  return (
    <section
      aria-label={f(m.itinerary.dayLabel, { number: day.number, date: dayLabel(day.date, i18n) })}
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
          <span className="sr-only">{f(m.itinerary.day, { number: day.number })}</span>
          <span className="pb-1.5">
            <Caption as="span" tone="ink" className="block">
              {dayLabel(day.date, i18n)}
            </Caption>
            <Caption as="span" className="mt-0.5 block">
              {tagText(day.tags, i18n)}
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
            {selected ? m.itinerary.showingOnMap : m.itinerary.showOnMap}
          </button>
        ) : null}
      </div>
      {events?.length ? (
        <ul className="mt-3 grid gap-0.5">
          {events.map((note) => (
            <li key={note} className="flex items-baseline gap-1.5 text-caption text-ink">
              <CalendarDays aria-hidden="true" size={13} strokeWidth={1.5} className="shrink-0 translate-y-0.5 text-ink-muted" />
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      {reason ? (
        <div className="mt-4 border-l-2 border-sea pl-3">
          <Caption as="p" tone="sea">
            {m.itinerary.aiReason}
          </Caption>
          <p className="mt-1 whitespace-pre-line text-caption text-ink">{reason}</p>
        </div>
      ) : null}
      {day.note ? (
        <div className="mt-4">
          <p className="text-body text-ink-muted">{noteText(day.note, i18n)}</p>
          {day.flightNote ? (
            <a href="#ucuslar" className="mt-1 inline-block text-caption underline underline-offset-4 print:hidden">
              {m.itinerary.betterFlights}
            </a>
          ) : null}
        </div>
      ) : null}
      {day.stops.length ? (
        <ol className="mt-5">
          {day.stops.flatMap((stop, i) => [
            ...(stop.kind === "evening" && day.free ? [<FreeTime key="free" free={day.free} />] : []),
            <TravelLine key={`${stop.id}-travel`} stop={stop} />,
            <Stop key={stop.id} stop={stop} number={i + 1} onRemove={onRemove} onRemoveInside={onRemoveInside} />,
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
  eventNotes,
}: Props) {
  const i18n = useI18n();
  const { intl, m, f } = i18n;
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
  // A place inside a stop is not in the chosen stops (it comes with its parent): removing it is always `?skip=`.
  const removeInside = (sub: PlanSubStop) => save({ skip: [...new Set([...skip, sub.shortId])] });
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
    const ics = buildIcs(plan, { cityName, now: new Date(), i18n });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${f(m.itinerary.icsFile, { city: cityName.toLocaleLowerCase(intl).replace(/[^a-z0-9ğüşıöç]+/g, "-") })}.ics`;
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
                {m.itinerary.flightUnknown}
              </Caption>
            ) : plan.basis === "flight" && flight ? (
              <Caption as="p" tone="ink">
                {f(m.itinerary.flightLine, {
                  flight: flight.label.toLocaleUpperCase(intl),
                  arrive: flight.arrive?.time ?? "",
                  leave: flight.leave?.time ?? "",
                  city: cityName.toLocaleUpperCase(intl),
                })}
              </Caption>
            ) : (
              <Caption as="p" tone="warn">
                {f(m.itinerary.noFlight, { city: cityName.toLocaleUpperCase(intl) })}
              </Caption>
            )}
            {ai ? (
              <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-muted">
                <Sparkles aria-hidden="true" size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                <span>
                  {f(m.itinerary.aiChose, { source: ai.source ? ` (${ai.source})` : "" })}
                  {ai.source ? "" : m.itinerary.aiReasonsLocal}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-caption text-ink-muted">
                {m.itinerary.chosenBy}
                {edits.length ? m.itinerary.editedByChat : m.itinerary.noAi}
              </p>
            )}
            <p className="mt-1 text-caption text-ink-muted">{m.itinerary.unknownHours}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={download}>
              <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.5} />
              {m.itinerary.addToCalendar}
            </Button>
            {changes ? (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" size={16} strokeWidth={1.5} />
                {f(m.itinerary.reset, { count: changes })}
              </Button>
            ) : null}
          </div>
        </div>

        {plan.dropped.length ? (
          <p className="mt-4 text-caption text-ink-muted">
            {f(m.itinerary.dropped, { count: plan.dropped.length })}
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
                onRemoveInside={removeInside}
                reason={ai?.reasons[d.number]}
                events={eventNotes?.[d.date]}
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
                    {f(m.itinerary.mapCaption, {
                      number: String(day.number).padStart(2, "0"),
                      date: dayLabel(day.date, i18n),
                      count: day.stops.length,
                    })}
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
                  {m.itinerary.showDayMap}
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
