import { INTL_LOCALE, type Locale } from "@/i18n/locales";

const TIME_ZONE = "Europe/Istanbul";

const cached = <T,>(make: (key: string) => T) => {
  const cache = new Map<string, T>();
  return (key: string) => {
    let value = cache.get(key);
    if (value === undefined) {
      value = make(key);
      cache.set(key, value);
    }
    return value;
  };
};

const dayFormatter = cached(
  (intl) => new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", weekday: "short", timeZone: TIME_ZONE }),
);

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

/** "14 Kas Cmt" / "14 Nov Sat" — day, short month, short weekday. */
export function formatDay(date: Date, locale: Locale = "tr"): string {
  const parts = dayFormatter(INTL_LOCALE[locale]).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("weekday")}`;
}

/** "08:45" — always 24-hour, in both languages. */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

const moneyFormatter = cached((key) => {
  const [intl, currency, fraction] = key.split(":");
  return new Intl.NumberFormat(intl, {
    style: "currency",
    currency,
    // English names lira by its sign ("₺12,450"), not "TRY 12,450".
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number(fraction),
    maximumFractionDigits: Number(fraction),
  });
});

/**
 * Minor units in a currency, with cents only when there are any. Intl gives the grouping, the decimal sign, the
 * symbol and where it sits: Turkish "€1.240", "$1.240,50"; English "€1,240", "₺12,450". Turkish lira keeps the
 * site's "12.450 ₺" (DESIGN.md), the symbol after the amount.
 */
export function formatMoney(minor: number, currency: string, locale: Locale = "tr"): string {
  const fraction = minor % 100 === 0 ? 0 : 2;
  const formatter = moneyFormatter(`${INTL_LOCALE[locale]}:${currency}:${fraction}`);
  if (currency !== "TRY" || locale !== "tr") return formatter.format(minor / 100);
  const number = formatter
    .formatToParts(minor / 100)
    .filter((p) => p.type !== "currency" && p.type !== "literal")
    .map((p) => p.value)
    .join("");
  return `${number} ₺`;
}

/** Whole lira: "12.450 ₺", in English "₺12,450". */
export function formatTRY(amount: number, locale: Locale = "tr"): string {
  return formatMoney(Math.round(amount) * 100, "TRY", locale);
}

/** The longest part kept on one line: 24 mono characters fit a 320px phone's card (about 256px) at 12px. */
const LONGEST_KEPT_PART = 24;

/**
 * A mono caption of " · "-separated parts ("4 GECE · 6 ARA PAZ → 10 ARA PER · 1 KİŞİ") that may break only between
 * its parts, never inside one ("1 / KİŞİ"): the spaces inside each part become no-break spaces. A part too long for
 * a narrow phone keeps its spaces, so nothing ever overflows; a time range never breaks at its dash. One text node, so it reads and matches as before.
 */
export function keepPartsTogether(text: string): string {
  return text
    .split(" · ")
    // No-break spaces inside a part, and word joiners around a range's dash ("17:10–19:05" breaks after "–" otherwise).
    .map((part) => (part.length <= LONGEST_KEPT_PART ? part.replace(/ /g, "\u00a0").replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2") : part))
    .join(" · ");
}
