import { parseOpeningHours, type WeekSchedule } from "@/lib/places/hours";

/** "open": surely open for the whole visit; "closed": surely not; "unknown": no hours, or hours we cannot read. */
export type OpenVerdict = "open" | "closed" | "unknown";

/**
 * Whether a place is open from `start` to `end` (minutes past midnight, `end`
 * may pass 1440) on `weekday` (0 = Monday). Spans that run past midnight from
 * the day before count, and a visit may run into the next day.
 */
export function openDuring(week: WeekSchedule, weekday: number, start: number, end: number): boolean {
  return openSpan(week, weekday, start, end) !== null;
}

/** The opening span (minutes, relative to `weekday`'s midnight) that covers the whole visit, or null. */
export function openSpan(week: WeekSchedule, weekday: number, start: number, end: number): { start: number; end: number } | null {
  const spans: Array<{ start: number; end: number }> = [];
  // The day before (spans past midnight), the day itself, and the next day (visits past midnight).
  for (const offset of [-1, 0, 1]) {
    const day = (weekday + offset + 7) % 7;
    for (const i of week[day]) spans.push({ start: i.start + offset * 1440, end: i.end + offset * 1440 });
  }
  spans.sort((a, b) => a.start - b.start);
  // Merge back-to-back spans (24/7, or 18:00-24:00 then 00:00-02:00).
  const merged: typeof spans = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged.find((s) => s.start <= start && end <= s.end) ?? null;
}

export function openVerdict(openingHours: string | undefined, weekday: number, start: number, end: number): OpenVerdict {
  return openCheck(openingHours, weekday, start, end).verdict;
}

/** The verdict, and when the place closes after a visit it is surely open for. */
export function openCheck(
  openingHours: string | undefined,
  weekday: number,
  start: number,
  end: number,
): { verdict: OpenVerdict; closesAt: number | null } {
  const week = parseOpeningHours(openingHours);
  if (!week) return { verdict: "unknown", closesAt: null };
  const span = openSpan(week, weekday, start, end);
  return span ? { verdict: "open", closesAt: span.end } : { verdict: "closed", closesAt: null };
}
