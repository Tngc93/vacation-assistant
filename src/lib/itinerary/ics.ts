import { CATEGORIES } from "@/lib/places/categories";
import type { Itinerary, PlanStop } from "./plan";

/**
 * A small RFC 5545 writer for the plan: one VEVENT per stop, local times with
 * the destination's TZID and a matching VTIMEZONE (built from the offsets the
 * trip actually uses, including a DST change during the trip), CRLF line
 * endings, lines folded at 75 octets, TEXT values escaped.
 */

const CRLF = "\r\n";
const encoder = new TextEncoder();

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets without splitting a UTF-8 character (§3.1). */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with one space, which counts towards their 75 octets.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const compact = (date: string, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;

/** UTC offset in minutes of `timeZone` at `instant`. */
export function offsetMinutes(timeZone: string, instant: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

const formatOffset = (minutes: number) => {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`;
};

/** The instant (ms) of a local wall time in `timeZone`. */
export function localToInstant(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset around a DST change.
  let instant = guess - offsetMinutes(timeZone, guess) * 60_000;
  instant = guess - offsetMinutes(timeZone, instant) * 60_000;
  return instant;
}

/** "YYYYMMDDTHHMMSS" of a wall-clock time stored as UTC milliseconds. */
function wallClock(ms: number): string {
  return new Date(Math.round(ms / 60_000) * 60_000).toISOString().replace(/[-:]/g, "").slice(0, 15);
}

/** VTIMEZONE covering [from, to]: one observance per offset used, with the real transition times. */
export function vtimezone(timeZone: string, from: number, to: number): string[] {
  const lines = ["BEGIN:VTIMEZONE", `TZID:${timeZone}`];
  const first = offsetMinutes(timeZone, from);
  const observance = (kind: "STANDARD" | "DAYLIGHT", start: string, fromOff: number, toOff: number) => [
    `BEGIN:${kind}`,
    `DTSTART:${start}`,
    `TZOFFSETFROM:${formatOffset(fromOff)}`,
    `TZOFFSETTO:${formatOffset(toOff)}`,
    `END:${kind}`,
  ];
  lines.push(...observance("STANDARD", "19700101T000000", first, first));
  let previous = first;
  for (let t = from; t <= to; t += 3_600_000) {
    const now = offsetMinutes(timeZone, t);
    if (now === previous) continue;
    // Narrow the change to the minute.
    let lo = t - 3_600_000;
    let hi = t;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (offsetMinutes(timeZone, mid) === previous) lo = mid;
      else hi = mid;
    }
    // DTSTART of an observance is the wall-clock time of the change in the old offset (e.g. 03:00 when clocks go back to 02:00).
    lines.push(...observance(now > previous ? "DAYLIGHT" : "STANDARD", wallClock(hi + previous * 60_000), previous, now));
    previous = now;
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

function description(stop: PlanStop): string {
  return [
    `${CATEGORIES[stop.category].label} · ${stop.durationMin} dk (tahmini)`,
    stop.address ? `Adres: ${stop.address}` : null,
    stop.hours === "unknown" ? "Açılış saatlerini doğrula." : null,
    stop.closesSoon ? `Kapanış: ${stop.closesSoon}` : null,
    `${stop.source}: ${stop.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const utcStamp = (date: Date) => `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

/** The whole plan as an iCalendar file. `now` sets DTSTAMP (passed in so the output is reproducible). */
export function buildIcs(plan: Itinerary, { cityName, now }: { cityName: string; now: Date }): string {
  const stops = plan.days.flatMap((d) => d.stops.map((s) => ({ day: d, stop: s })));
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vacation Assistant//Gün gün plan//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  lines.push(`X-WR-CALNAME:${escapeText(`${cityName} gezisi`)}`, `X-WR-TIMEZONE:${plan.timeZone}`);
  if (stops.length) {
    const firstDay = plan.days[0].date;
    const lastDay = plan.days.at(-1)!.date;
    lines.push(...vtimezone(plan.timeZone, localToInstant(firstDay, "00:00", plan.timeZone), localToInstant(lastDay, "23:59", plan.timeZone)));
  }
  for (const { day, stop } of stops) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${day.date}-${stop.shortId}@vacation-assistant`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=${plan.timeZone}:${compact(day.date, stop.start)}`,
      `DTEND;TZID=${plan.timeZone}:${compact(day.date, stop.end)}`,
      `SUMMARY:${escapeText(stop.name)}`,
      `LOCATION:${escapeText(stop.address ?? stop.name)}`,
      `GEO:${stop.lat.toFixed(6)};${stop.lon.toFixed(6)}`,
      `DESCRIPTION:${escapeText(description(stop))}`,
      `URL:${stop.sourceUrl}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
