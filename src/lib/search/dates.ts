/**
 * Trip date rules. Dates are plain ISO calendar dates ("2026-11-14"),
 * interpreted in Istanbul time, the site's home zone: trips first left only from Turkey, and "today" stays
 * Istanbul's now that any city can be the origin (2026-10-29).
 */

export const MAX_NIGHTS = 30;
export const MAX_MONTHS_AHEAD = 12;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Same day of month N months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Today's date in Istanbul. */
export function todayInIstanbul(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Latest selectable date: 12 months from today. */
export function latestTripDate(today: string): string {
  return addMonths(today, MAX_MONTHS_AHEAD);
}

/** Midday UTC for an ISO date, safe to format in any time zone near Turkey. */
export function isoToDate(iso: string): Date {
  const date = toUtc(iso);
  date.setUTCHours(12);
  return date;
}

/** A broken trip rule; the interface words it (messages `search.issues`). */
export type DateIssueCode = "departPast" | "departTooFar" | "returnNotAfter" | "returnTooLong" | "returnTooFar";
export type DateIssue = { field: "depart" | "return"; code: DateIssueCode };

/** Checks the trip rules: no past dates, return after departure, at most 30 nights, at most 12 months ahead. */
export function checkTripDates(depart: string, ret: string, today: string): DateIssue[] {
  const issues: DateIssue[] = [];
  const latest = latestTripDate(today);

  if (depart < today) {
    issues.push({ field: "depart", code: "departPast" });
  } else if (depart > latest) {
    issues.push({ field: "depart", code: "departTooFar" });
  }

  const nights = daysBetween(depart, ret);
  if (nights < 1) {
    issues.push({ field: "return", code: "returnNotAfter" });
  } else if (nights > MAX_NIGHTS) {
    issues.push({ field: "return", code: "returnTooLong" });
  } else if (ret > latest && depart <= latest) {
    issues.push({ field: "return", code: "returnTooFar" });
  }

  return issues;
}
