/**
 * Which of the city's events fall in the trip, and how they are written. Pure functions over ISO calendar dates
 * ("2026-11-14"); no clock is read here.
 */
import { addDays } from "@/lib/search/dates";
import type { EventEdition, StoredEvent } from "./file";

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

const SHORT_MONTHS = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"];
const MONTHS = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];

/** "14 KAS" */
function shortDay(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

/** "14 KAS – 18 KAS", or "14 KAS" for one day. */
export function editionCaption(edition: Pick<EventEdition, "start" | "end">): string {
  return edition.start === edition.end ? shortDay(edition.start) : `${shortDay(edition.start)} – ${shortDay(edition.end)}`;
}

/**
 * Months as runs, wrapping over the new year: [9, 10] → "EYLÜL–EKİM", [1, 12] → "ARALIK–OCAK",
 * [2, 6] → "ŞUBAT, HAZİRAN".
 */
export function monthsText(months: readonly number[]): string {
  const set = [...new Set(months)].sort((a, b) => a - b);
  if (set.length === 0) return "";
  if (set.length === 12) return "YIL BOYU";
  // Start a run at a month whose previous month is not in the set, so December–January stays together.
  const starts = set.filter((m) => !set.includes(m === 1 ? 12 : m - 1));
  const runs = starts.map((start) => {
    let end = start;
    while (set.includes(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return start === end ? MONTHS[start - 1] : `${MONTHS[start - 1]}–${MONTHS[end - 1]}`;
  });
  return runs.join(", ");
}

/** "GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA" */
export function approximateCaption(months: readonly number[]): string {
  return `GENELDE ${monthsText(months)} · TARİHİ DOĞRULA`;
}

/** The card's date caption. */
export function tripEventCaption(item: TripEvent): string {
  return item.kind === "exact" ? editionCaption(item.edition) : approximateCaption(item.months);
}

/** The masthead line: the most important exact event, "BU TARİHLERDE: OKTOBERFEST"; null without one. */
export function mastheadLine(items: readonly TripEvent[]): string | null {
  const first = items.find((i) => i.kind === "exact");
  return first ? `BU TARİHLERDE: ${first.event.name.toLocaleUpperCase("tr")}` : null;
}

/**
 * Notes for the plan's day headers: on each day inside an exact event's edition, "Bugün şehirde: Oktoberfest ·
 * Theresienwiese" (most important first). Approximate events never get a day note: their days are not known.
 */
export function dayNotes(items: readonly TripEvent[], depart: string, ret: string): Record<string, string[]> {
  const notes: Record<string, string[]> = {};
  for (let day = depart; day <= ret; day = addDays(day, 1)) {
    const here = items.flatMap((i) =>
      i.kind === "exact" && i.edition.start <= day && day <= i.edition.end
        ? [`Bugün şehirde: ${i.event.name}${i.event.venue ? ` · ${i.event.venue.name}` : ""}`]
        : [],
    );
    if (here.length) notes[day] = here;
  }
  return notes;
}

/** A stable id for an event in the carousel and on the page. */
export const eventItemId = (event: Pick<StoredEvent, "qid">) => `event/${event.qid}`;
