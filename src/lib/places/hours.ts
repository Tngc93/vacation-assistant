/**
 * A deliberately small parser for OSM `opening_hours`. It understands the
 * common weekly form — day ranges, several time ranges, past-midnight
 * closing, `off`/`closed` and `24/7` — and refuses everything else (public
 * holidays, months, sunrise, comments, fallback rules…). A refused value is
 * hidden in the UI: no information is better than wrong information.
 */

/** Minutes from the day's start; `end` may pass 1440 when a place closes after midnight. */
export type Interval = { start: number; end: number };
/** Index 0 = Monday … 6 = Sunday. */
export type WeekSchedule = Interval[][];

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export const DAY_NAMES_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const DAY_SELECTOR = new RegExp(`^${DAY}(?:-${DAY})?(?:,${DAY}(?:-${DAY})?)*$`);
const TIME_RANGE = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

function parseDays(selector: string): number[] | null {
  if (!DAY_SELECTOR.test(selector)) return null;
  const days = new Set<number>();
  for (const part of selector.split(",")) {
    const [from, to] = part.split("-").map((d) => DAYS.indexOf(d as (typeof DAYS)[number]));
    if (to === undefined) {
      days.add(from);
      continue;
    }
    // Ranges may wrap around the week (Fr-Mo).
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
  }
  return [...days].sort();
}

function parseTimes(text: string): Interval[] | null {
  const intervals: Interval[] = [];
  for (const part of text.split(",")) {
    const match = TIME_RANGE.exec(part.trim());
    if (!match) return null;
    const [h1, m1, h2, m2] = match.slice(1).map(Number);
    if (h1 > 24 || m1 > 59 || h2 > 48 || m2 > 59) return null;
    const start = h1 * 60 + m1;
    let end = h2 * 60 + m2;
    if (start >= 1440) return null;
    if (end <= start) end += 1440;
    if (end - start > 1440) return null;
    intervals.push({ start, end });
  }
  return intervals.sort((a, b) => a.start - b.start);
}

/** Weekly schedule, or null when the value uses anything outside the supported subset. */
export function parseOpeningHours(value: string | undefined): WeekSchedule | null {
  const text = value?.trim();
  if (!text) return null;
  if (text === "24/7") return Array.from({ length: 7 }, () => [{ start: 0, end: 1440 }]);

  const week: WeekSchedule = Array.from({ length: 7 }, () => []);
  let sawRule = false;
  for (const raw of text.split(";")) {
    // "Tu-We, Fr-Su" → "Tu-We,Fr-Su".
    let rule = raw.trim().replace(/,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, ",");
    // "Mo-Su,PH 10:00-22:00" opens on public holidays too, so the weekly hours are right either way.
    // A rule that closes on holidays ("PH off") is refused: we cannot know which days are holidays.
    if (/(^|,)PH(,|\s)/.test(rule)) {
      const withoutPh = rule.replace(/(^|,)PH(?=,|\s)/, "").replace(/^,/, "");
      if (/^\s/.test(withoutPh) || /\b(off|closed)\b/i.test(rule)) return null;
      rule = withoutPh;
    }
    if (!rule) continue;
    const match = /^(?:(\S+)\s+)?(.+)$/.exec(rule);
    if (!match) return null;
    let selector: string | undefined = match[1];
    let body = match[2];
    // A rule with no day selector applies to every day ("10:00-14:00, 16:00-20:00").
    if (selector && !DAY_SELECTOR.test(selector)) {
      if (!/^\d{2}:\d{2}-/.test(selector)) return null;
      body = `${selector}${body}`;
      selector = undefined;
    }
    const days = selector ? parseDays(selector) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const closed = /^(off|closed)$/i.test(body.trim());
    const intervals = closed ? [] : parseTimes(body.replace(/\s+/g, ""));
    if (!intervals) return null;
    // Later rules replace earlier ones for the days they name (OSM semantics).
    for (const d of days) week[d] = intervals;
    sawRule = true;
  }
  if (!sawRule || week.every((day) => day.length === 0)) return null;
  return week;
}

/** Weekday (0 = Monday) and minute of the day in a time zone. */
export function localWeekMinute(now: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const clock = (minutes: number) => `${pad(Math.floor((minutes % 1440) / 60))}:${pad(minutes % 60)}`;

// Locative suffix by how the last number of the time is read aloud in Turkish.
const ONES = ["da", "de", "de", "te", "te", "te", "da", "de", "de", "da"]; // sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
const TENS = ["", "da", "de", "da", "ta", "de"]; // on, yirmi, otuz, kırk, elli

/** "18:00'de", "09:30'da", "13:00'te", "14:40'ta" */
export function withLocative(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const n = m === 0 ? h : m;
  const suffix = n === 0 ? "da" : n % 10 === 0 ? TENS[n / 10] ?? "da" : ONES[n % 10];
  return `${time}'${suffix}`;
}

export type OpenStatus =
  | { open: true; text: string }
  | { open: false; text: string };

/** "Şu an açık · 18:00'de kapanır" / "Şu an kapalı · yarın 09:30'da açılır", or null when it cannot be said. */
export function openStatus(week: WeekSchedule, now: Date, timeZone: string): OpenStatus | null {
  const { day, minute } = localWeekMinute(now, timeZone);
  if (day < 0) return null;
  // Absolute minutes since this week's Monday 00:00, with the week repeated so overnight spans wrap.
  const nowAbs = day * 1440 + minute;
  const spans: Interval[] = [];
  for (let w = -1; w <= 1; w++) {
    week.forEach((intervals, d) => {
      for (const i of intervals) spans.push({ start: (w * 7 + d) * 1440 + i.start, end: (w * 7 + d) * 1440 + i.end });
    });
  }
  spans.sort((a, b) => a.start - b.start);

  const current = spans.find((s) => s.start <= nowAbs && nowAbs < s.end);
  if (current) {
    // Follow back-to-back spans (e.g. 24/7 or 18:00-24:00 then 00:00-02:00).
    let end = current.end;
    for (let guard = 0; guard < 21; guard++) {
      const next = spans.find((s) => s.start === end);
      if (!next) break;
      end = next.end;
    }
    if (end - nowAbs >= 7 * 1440) return { open: true, text: "Şu an açık · 7/24" };
    return { open: true, text: `Şu an açık · ${withLocative(clock(end))} kapanır` };
  }

  const next = spans.find((s) => s.start > nowAbs);
  if (!next || next.start - nowAbs > 7 * 1440) return null;
  const nextDay = Math.floor(next.start / 1440);
  const when =
    nextDay === day ? "bugün" : nextDay === day + 1 ? "yarın" : DAY_NAMES_TR[((nextDay % 7) + 7) % 7];
  return { open: false, text: `Şu an kapalı · ${when} ${withLocative(clock(next.start))} açılır` };
}

/** Readable week, grouping consecutive days with the same hours: "Pazartesi–Cuma 09:00–18:00". */
export function describeWeek(week: WeekSchedule): string[] {
  const label = (intervals: Interval[]) =>
    intervals.length === 0
      ? "kapalı"
      : intervals.map((i) => (i.end - i.start >= 1440 ? "tüm gün" : `${clock(i.start)}–${clock(i.end)}`)).join(", ");
  const lines: string[] = [];
  let from = 0;
  for (let d = 1; d <= 7; d++) {
    if (d < 7 && label(week[d]) === label(week[from])) continue;
    const days = from === d - 1 ? DAY_NAMES_TR[from] : `${DAY_NAMES_TR[from]}–${DAY_NAMES_TR[d - 1]}`;
    lines.push(`${days} ${label(week[from])}`);
    from = d;
  }
  return lines;
}

/** "BUGÜN AÇIK · 09:00–20:00", "BUGÜN KAPALI": today's hours in the city's time zone; null outside the format. */
export function todayStatus(week: WeekSchedule, now: Date, timeZone: string): { open: boolean; text: string } | null {
  const { day } = localWeekMinute(now, timeZone);
  if (day < 0) return null;
  const intervals = week[day] ?? [];
  if (intervals.length === 0) return { open: false, text: "BUGÜN KAPALI" };
  const hours = intervals.map((i) => (i.end - i.start >= 1440 ? "TÜM GÜN" : `${clock(i.start)}–${clock(i.end)}`)).join(", ");
  return { open: true, text: `BUGÜN AÇIK · ${hours}` };
}
