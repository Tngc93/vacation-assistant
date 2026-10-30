"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useImperativeHandle, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { DayPicker, type ChevronProps, type Matcher } from "react-day-picker";
import { enGB, tr } from "react-day-picker/locale";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { addDays, daysBetween, isoToDate, latestTripDate, MAX_NIGHTS, todayInIstanbul } from "@/lib/search/dates";

export type DateRange = { depart?: string; return?: string };

/** Lets a parent open the calendar (the home page's "Keşfet" city chips). */
export type DateRangeFieldHandle = { open: () => void };

export type DateRangeFieldProps = {
  ref?: Ref<DateRangeFieldHandle>;
  value: DateRange;
  onChange: (value: DateRange) => void;
  departError?: string;
  returnError?: string;
  /** Overrides "today" (Istanbul) — used by tests. */
  today?: string;
};

// The calendar works with local-midnight Date objects; the app stores ISO dates.
function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 48rem)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width: 48rem)").matches,
    () => false,
  );
}

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return <Icon aria-hidden="true" size={16} strokeWidth={1.5} className={className} />;
}

const dayButton =
  "flex size-10 items-center justify-center rounded-sm font-mono text-caption tabular text-ink " +
  "transition-colors duration-150 ease-out hover:bg-rule";

/**
 * Departure and return dates in one range calendar (in the interface language, weeks start on
 * Monday). The first pick is the departure, the second the return; picking a
 * day on or before the departure starts again.
 */
export function DateRangeField({ ref, value, onChange, departError, returnError, today: todayOverride }: DateRangeFieldProps) {
  const { locale, m, f } = useI18n();
  const id = useId();
  const dialogId = `${id}-calendar`;
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<string | null>(todayOverride ?? null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const departButtonRef = useRef<HTMLButtonElement>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const wide = useIsWide();

  const openCalendar = () => {
    // "Today" is read when the calendar opens, never during rendering.
    setToday(todayOverride ?? todayInIstanbul(new Date()));
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({ open: openCalendar }));

  const closeCalendar = (focus?: "depart" | "return") => {
    setOpen(false);
    if (focus === "depart") departButtonRef.current?.focus();
    if (focus === "return") returnButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const pickingReturn = Boolean(value.depart && !value.return);

  const onDayPick = (day: Date) => {
    const picked = toIso(day);
    if (!value.depart || value.return || picked <= value.depart) {
      onChange({ depart: picked, return: undefined });
      return;
    }
    onChange({ depart: value.depart, return: picked });
    closeCalendar("return");
  };

  const disabled: Matcher[] = [];
  if (today) {
    disabled.push({ before: toLocalDate(today) }, { after: toLocalDate(latestTripDate(today)) });
    if (pickingReturn && value.depart) {
      disabled.push({ after: toLocalDate(addDays(value.depart, MAX_NIGHTS)) });
    }
  }

  const nights = value.depart && value.return ? daysBetween(value.depart, value.return) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="grid grid-cols-2 gap-4">
        <DateTrigger
          ref={departButtonRef}
          label={m.search.depart}
          value={value.depart}
          error={departError}
          expanded={open}
          controls={dialogId}
          onClick={() => (open ? closeCalendar() : openCalendar())}
        />
        <DateTrigger
          ref={returnButtonRef}
          label={m.search.return}
          value={value.return}
          error={returnError}
          expanded={open}
          controls={dialogId}
          onClick={() => (open ? closeCalendar() : openCalendar())}
        />
      </div>

      {open && today ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={pickingReturn ? m.search.pickReturn : m.search.pickDepart}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeCalendar(pickingReturn ? "return" : "depart");
            }
          }}
          className="absolute left-0 top-full z-40 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-md border border-rule bg-paper-raised p-4 shadow-ticket md:p-5"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="font-mono text-micro uppercase tracking-[0.08em] text-accent">
              {pickingReturn ? m.search.pickReturn : m.search.pickDepart}
            </p>
            <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
              {f(m.search.maxNights, { count: MAX_NIGHTS })}
            </p>
          </div>
          <DayPicker
            mode="range"
            locale={locale === "en" ? enGB : tr}
            weekStartsOn={1}
            numberOfMonths={wide ? 2 : 1}
            autoFocus
            showOutsideDays={false}
            startMonth={toLocalDate(today)}
            endMonth={toLocalDate(latestTripDate(today))}
            defaultMonth={toLocalDate(value.depart ?? today)}
            selected={{
              from: value.depart ? toLocalDate(value.depart) : undefined,
              to: value.return ? toLocalDate(value.return) : undefined,
            }}
            onSelect={(_, triggerDate) => onDayPick(triggerDate)}
            disabled={disabled}
            // A half-made range (departure only) is not marked as range_start, so mark it ourselves.
            modifiers={{ departOnly: pickingReturn && value.depart ? toLocalDate(value.depart) : false }}
            modifiersClassNames={{ departOnly: "[&>button]:bg-accent [&>button]:text-accent-ink [&>button]:hover:bg-accent" }}
            components={{ Chevron: CalendarChevron }}
            classNames={{
              root: "relative text-ink",
              months: "flex flex-col gap-6 md:flex-row md:gap-8",
              month: "flex flex-col gap-3",
              month_caption: "flex h-9 items-center px-11 md:justify-center",
              caption_label: "font-display text-heading capitalize",
              nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
              button_previous:
                "inline-flex size-9 items-center justify-center rounded-sm border border-rule text-ink hover:border-ink disabled:opacity-30 disabled:hover:border-rule",
              button_next:
                "inline-flex size-9 items-center justify-center rounded-sm border border-rule text-ink hover:border-ink disabled:opacity-30 disabled:hover:border-rule",
              chevron: "",
              month_grid: "border-collapse",
              weekdays: "",
              weekday: "h-8 w-10 font-mono text-micro font-normal uppercase tracking-[0.06em] text-ink-muted",
              weeks: "",
              week: "",
              day: "p-0 text-center",
              day_button: dayButton,
              today: "[&>button]:underline [&>button]:decoration-accent [&>button]:decoration-2 [&>button]:underline-offset-4",
              selected: "",
              range_start: "[&>button]:bg-accent [&>button]:text-accent-ink [&>button]:hover:bg-accent",
              range_end: "[&>button]:bg-accent [&>button]:text-accent-ink [&>button]:hover:bg-accent",
              range_middle: "bg-rule [&>button]:rounded-none",
              disabled: "[&>button]:cursor-not-allowed [&>button]:text-ink-muted [&>button]:opacity-40 [&>button]:hover:bg-transparent",
              outside: "invisible",
              hidden: "invisible",
              focused: "",
              footer: "",
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-rule pt-3">
            <p className="font-mono text-caption tabular text-ink-muted" aria-live="polite">
              {nights
                ? f(m.search.nights, { count: nights })
                : value.depart
                  ? f(m.search.departOn, { date: formatDay(isoToDate(value.depart), locale) })
                  : m.search.pickDepartFirst}
            </p>
            <button
              type="button"
              onClick={() => closeCalendar(pickingReturn ? "return" : "depart")}
              className="h-9 rounded-sm px-3 text-caption font-medium text-ink hover:bg-rule"
            >
              {m.search.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type DateTriggerProps = {
  ref: React.Ref<HTMLButtonElement>;
  label: string;
  value: string | undefined;
  error?: string;
  expanded: boolean;
  controls: string;
  onClick: () => void;
};

function DateTrigger({ ref, label, value, error, expanded, controls, onClick }: DateTriggerProps): ReactNode {
  const { locale, m } = useI18n();
  const errorId = useId();
  return (
    <div className="min-w-0">
      <span className="font-mono text-micro uppercase tracking-[0.08em] text-ink-muted" aria-hidden="true">
        {label}
      </span>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? controls : undefined}
        aria-label={`${label}: ${value ? formatDay(isoToDate(value), locale) : m.search.noDate}`}
        aria-describedby={error ? errorId : undefined}
        onClick={onClick}
        className={cn(
          "mt-1 flex h-11 w-full items-center gap-2 rounded-sm border bg-paper px-3 text-left transition-colors duration-150 ease-out hover:border-ink",
          error ? "border-warn" : "border-rule",
        )}
      >
        <CalendarDays aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
        <span className={cn("truncate font-mono text-caption tabular sm:text-body", value ? "text-ink" : "text-ink-muted")}>
          {value ? formatDay(isoToDate(value), locale) : m.search.pickDate}
        </span>
      </button>
      {error ? (
        <p id={errorId} className="mt-1.5 text-caption text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
