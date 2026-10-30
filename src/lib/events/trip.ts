/**
 * Which of the city's events fall in the trip, and how they are written. Pure functions over ISO calendar dates
 * ("2026-11-14"); no clock is read here.
 */
import { addDays } from "@/lib/search/dates";
import type { I18n } from "@/i18n/i18n";
import { eventName, type EventEdition, type StoredEvent } from "./file";

/** An event in the trip: exact (an edition overlaps the dates) or approximate (one of its months does). */
export type TripEvent =
  | { kind: "exact"; event: StoredEvent; edition: EventEdition }
  | { kind: "approximate"; event: StoredEvent; months: number[] };

/** True when the two inclusive date ranges share at least one day. */
export function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** The calendar months (1–12) the trip touches, in trip order: 30 Dec–2 Jan → [12, 1]. */
export function tripMonths(depart: string, ret: string): number[] {
  const months: number[] = [];
  for (let day = depart; day <= ret; day = addDays(day, 1)) {
    const month = Number(day.slice(5, 7));
    if (!months.includes(month)) months.push(month);
  }
  return months;
}

/**
 * The events in the trip: exact ones first (by importance), then approximate ones. An event with exact editions
 * is shown only when an edition overlaps the trip; its months are never used as a fallback.
 */
export function eventsInTrip(events: readonly StoredEvent[], depart: string, ret: string): TripEvent[] {
  const trip = { start: depart, end: ret };
  const months = tripMonths(depart, ret);
  const exact: TripEvent[] = [];
  const approximate: TripEvent[] = [];
  for (const event of events) {
    if (event.editions) {
      const edition = event.editions.find((e) => rangesOverlap(e, trip));
      if (edition) exact.push({ kind: "exact", event, edition });
    } else if (event.months?.some((m) => months.includes(m))) {
      approximate.push({ kind: "approximate", event, months: event.months });
    }
  }
  const byImportance = (a: TripEvent, b: TripEvent) => b.event.wikipedias - a.event.wikipedias || (a.event.qid < b.event.qid ? -1 : 1);
  return [...exact.sort(byImportance), ...approximate.sort(byImportance)];
}

/** The event captions need the interface language: its Intl locale (month names) and messages. */
type Lang = Pick<I18n, "locale" | "intl" | "m" | "f">;

const monthFormatters = new Map<string, { short: Intl.DateTimeFormat; long: Intl.DateTimeFormat }>();
function monthName(month: number, intl: string, width: "short" | "long"): string {
  let f = monthFormatters.get(intl);
  if (!f) {
    f = {
      short: new Intl.DateTimeFormat(intl, { month: "short", timeZone: "UTC" }),
      long: new Intl.DateTimeFormat(intl, { month: "long", timeZone: "UTC" }),
    };
    monthFormatters.set(intl, f);
  }
  return f[width].format(new Date(Date.UTC(2026, month - 1, 15))).replace(/\.$/, "").toLocaleUpperCase(intl);
}

/** "14 KAS" ("14 NOV") */
function shortDay(iso: string, intl: string): string {
  return `${Number(iso.slice(8, 10))} ${monthName(Number(iso.slice(5, 7)), intl, "short")}`;
}

/** "14 KAS – 18 KAS", or "14 KAS" for one day ("14 NOV – 18 NOV" in English). */
export function editionCaption(edition: Pick<EventEdition, "start" | "end">, intl = "tr-TR"): string {
  return edition.start === edition.end ? shortDay(edition.start, intl) : `${shortDay(edition.start, intl)} – ${shortDay(edition.end, intl)}`;
}

/**
 * Months as runs, wrapping over the new year: [9, 10] → "EYLÜL–EKİM", [1, 12] → "ARALIK–OCAK",
 * [2, 6] → "ŞUBAT, HAZİRAN" (in English "SEPTEMBER–OCTOBER").
 */
export function monthsText(months: readonly number[], { intl, m }: Pick<Lang, "intl" | "m">): string {
  const set = [...new Set(months)].sort((a, b) => a - b);
  if (set.length === 0) return "";
  if (set.length === 12) return m.events.allYear;
  // Start a run at a month whose previous month is not in the set, so December–January stays together.
  const starts = set.filter((x) => !set.includes(x === 1 ? 12 : x - 1));
  const name = (x: number) => monthName(x, intl, "long");
  const runs = starts.map((start) => {
    let end = start;
    while (set.includes(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return start === end ? name(start) : `${name(start)}–${name(end)}`;
  });
  return runs.join(", ");
}

/** "GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA" ("USUALLY SEPTEMBER–OCTOBER · CHECK THE DATES") */
export function approximateCaption(months: readonly number[], lang: Lang): string {
  return lang.f(lang.m.events.usually, { months: monthsText(months, lang) });
}

/** The card's date caption. */
export function tripEventCaption(item: TripEvent, lang: Lang): string {
  return item.kind === "exact" ? editionCaption(item.edition, lang.intl) : approximateCaption(item.months, lang);
}

/** The masthead line: the most important exact event, "BU TARİHLERDE: OKTOBERFEST"; null without one. */
export function mastheadLine(items: readonly TripEvent[], lang: Lang): string | null {
  const first = items.find((i) => i.kind === "exact");
  return first ? lang.f(lang.m.events.onTheseDates, { name: eventName(first.event, lang.locale).toLocaleUpperCase(lang.intl) }) : null;
}

/**
 * Notes for the plan's day headers: on each day inside an exact event's edition, "Bugün şehirde: Oktoberfest ·
 * Theresienwiese" (most important first). Approximate events never get a day note: their days are not known.
 */
export function dayNotes(items: readonly TripEvent[], depart: string, ret: string, lang: Lang): Record<string, string[]> {
  const notes: Record<string, string[]> = {};
  const en = lang.locale === "en";
  for (let day = depart; day <= ret; day = addDays(day, 1)) {
    const here = items.flatMap((i) => {
      if (i.kind !== "exact" || day < i.edition.start || i.edition.end < day) return [];
      const venue = i.event.venue ? (en ? (i.event.venue.nameEn ?? i.event.venue.name) : i.event.venue.name) : undefined;
      return [lang.f(lang.m.events.inTownToday, { name: `${eventName(i.event, lang.locale)}${venue ? ` · ${venue}` : ""}` })];
    });
    if (here.length) notes[day] = here;
  }
  return notes;
}

/** A stable id for an event in the carousel and on the page. */
export const eventItemId = (event: Pick<StoredEvent, "qid">) => `event/${event.qid}`;
